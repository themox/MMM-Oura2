#!/usr/bin/python3

import warnings
warnings.filterwarnings("ignore")

import requests
import json
import pandas as pd
import numpy as np
import sys
import argparse

from datetime import datetime, date
from dateutil.relativedelta import relativedelta

###############
# Full Oura API documentation at https://cloud.ouraring.com/docs
###############

def renameHRCols(col):
	if isinstance(col, tuple):
		col = '_'.join(str(c) for c in col)
		col = 'hr_'+ col
	return col

def getHRData(startDate, endDate, token):

	# heartrate can only pass 29 days worth of data per query.  It's a LOT of data...
	# Will page more than 20 days worth of data
	# @todo error checking on start/end date.

	url = ""
	dropColumns = ["source"]
	params = {}
	hasNextToken = True
	nextToken = None
	df = None

	url = "https://api.ouraring.com/v2/usercollection/heartrate"

	# heartrate api uses the iso format, e.g. '2021-11-01T00:00:00-08:00'
	dateformat = "%Y-%m-%d"

	# @todo need to detect and/or automatically set the timezone offset
	startDatetime = startDate + "T00:00:00-04:00" # beginning of the first day
	endDatetime = endDate + "T23:59:59-04:00"     # end of the last day

	while hasNextToken:
		params = { 
			'start_datetime': startDatetime, 
			'end_datetime': endDatetime
		}

		if not (nextToken == None):
			params["next_token"] = nextToken

		# Set up authorization header
		headers = { 
		  'Authorization': 'Bearer ' + token 
		}

		# Get the data
		response = requests.request('GET', url, headers=headers, params=params).json()

		# @todo error checking here before trying to access next_token
		nextToken = response["next_token"]

		if (nextToken == None):
			hasNextToken = False

		if (type(df) == type(None)):
			# first time through
			df = pd.DataFrame(response["data"])

		else:
			# second and beyond time through
			df = pd.concat([df, pd.DataFrame(response["data"])], ignore_index = True)

	# data comes back in giant array of bpm, source, timestamp.  Need to
	# 1) split into days
	# 2) split into awake/sleep? [Oura doesn't have anything but "awake" yet"]
	# 3) process each day for summary stats

	df['day'] = np.array(df.shape[0])

	for i in np.arange(0, df.shape[0]):
		df.loc[i, 'day'] = datetime.fromisoformat(df.loc[i, 'timestamp']).strftime(dateformat)

	dropColumns = ["timestamp"]
	df.drop(columns=dropColumns, inplace=True, errors='ignore')

	# Convert giant table down to a series of days with aggregate data for each day
	# Pandas is great!  Lots of other options for aggfunc available as well
	df = pd.pivot_table(data = df, index = ['day'], values = 'bpm', aggfunc = ['mean', 'max', 'min'])

	# HR column names are tuples due to the pivot table, need to be renamed differently
	df.columns = map(renameHRCols, df.columns)    

	# adjust all fields that aren't values
	df = df.fillna(0)
	
	return df

def getHttpResponse(page, startDate, endDate, token):

	#f'https://api.ouraring.com/v2/usercollection/{url}
	url = f'https://api.ouraring.com/v2/usercollection/{page}' 

	params = { 
		'start_date': startDate, 
		'end_date': endDate 
	}

	# Set up authorization header
	headers = { 
	  'Authorization': 'Bearer ' + token 
	}

	# Get the data
	response = requests.request('GET', url, headers=headers, params=params) 

	return response


def getDailyDataV2(dataType, startDate, endDate, token):

	okTypes = ["activity", "workouts", "readiness"]
	url = ""
	dropColumns = []
	params = {}

	# assume startDate and endDate are correctly formatted
	# @todo add error checking for that
	if not okTypes.__contains__(dataType):
		# @todo error!
		return None

	# Construct the V2 API URL
	# DailyActivity
	if dataType == "activity":
		url = 'daily_activity' 

		# See response schema at Oura's website: https://cloud.ouraring.com/v2/docs#operation/daily_activity_route_daily_activity_get
		dropColumns = ["class_5_min", "average_met_minutes", "contributors", "equivalent_walking_distance", "high_activity_met_minutes",
		"high_activity_time", "inactivity_alerts", "low_activity_met_minutes", "low_activity_time", "medium_activity_met_minutes",
		"medium_activity_time", "meters_to_target", "non_wear_time", "resting_time",  "sedentary_met_minutes", "sedentary_time",
		"target_calories", "target_meters", "timestamp", "met", "id"]

		# Keep columns: score, active_calories, steps, total_calories, day		

	elif dataType == "workouts":
		url = 'workout' 

		# see response schema at Oura's website: https://cloud.ouraring.com/v2/docs#operation/workouts_route_workout_get
		dropColumns = ['end_datetime', 'source', 'start_datetime', 'distance']

		# Keep Columns: day, activity, calories, intensity


	elif dataType == "readiness":
		url = 'daily_readiness' 

		dropColumns = ["id", "timestamp", "temperature_deviation","contributors", "temperature_trend_deviation"]

	else: 
		# @todo error!
		pass

	response = getHttpResponse(url, startDate, endDate, token)
 

	# @todo error checking on  the response

	# convert to pandas dataframe for easier handling
	df = pd.DataFrame(response.json()["data"])
	# @todo check for presence of "data"; if error, will not be here and will need to account for that

	if dataType == 'workouts':
		# add a new column of duration before removing start/end times
		# Oura is using ISO 8601, looks like: "2022-03-18T22:14:00-04:00"

		df['duration'] = np.array(df.shape[0])

		for i in np.arange(0, df.shape[0]):
			df.loc[i,'duration'] = datetime.fromisoformat(df.loc[i,'end_datetime']) - datetime.fromisoformat(df.loc[i, 'start_datetime'])

		pass

	elif dataType == 'readiness':
		contributors = df.loc[0]["contributors"]
		df = df.reindex(columns = df.columns.tolist() + list(contributors.keys()))

		for i in range(0, df.shape[0]):
			contributors = df.loc[i]["contributors"]
			for key in contributors.keys():
				df[key].iat[i] = contributors[key]

	# Drop extra columns we're not going to use so we're not passing all that data back and forth
	# Easy enough to come in here later and fix it if we want to use them
	df.drop(columns=dropColumns, inplace=True, errors='ignore')
	df.set_index('day', inplace=True)
	
	#rename all column names to prepend the type of data; makes figuring out later easier when all combined
	for column in df.columns.values:
		if not (dataType in column):
			df.rename(columns={column: dataType + "_" + column}, inplace=True, errors="raise")
	
	df = df.fillna(0)

	return df

def getSleepDataV2(dataType, startDate, endDate, token):
	okTypes = ["sleep"]
	dropColumns = []
	
	# assume startDate and endDate are correctly formatted
	# @todo add error checking for that
	if not okTypes.__contains__(dataType):
		# @todo error!
		return None

	# In V2, sleep data is spread across a couple queries
	urls = ['sleep', 'daily_sleep']

	responses = {}
	for url in urls:
		response = getHttpResponse(url, startDate, endDate, token)
		#print(response)
		if response.status_code == 200:
			responses[url] = response
		else:
			print("didn't get data")
			got_data = False
			break

	#print(responses)

	# daily_sleep
	df = pd.DataFrame(responses["daily_sleep"].json()["data"])

	# Drop columns we don't need
	df.drop(columns=["id", "contributors", "timestamp"], inplace=True, errors='ignore')

	# sleep
	df2 = pd.DataFrame(responses["sleep"].json()["data"])

	# Remove multiple entries per "day" - people should theoretically only have one "long_sleep" per day
	# and that's what I think we care about.  
	df2 = df2.loc[df2["type"]=="long_sleep"]

	# Drop columns we don't need
	df2.drop(columns=["id", "sleep_algorithm_version", "time_in_bed", "heart_rate", "deep_sleep_duration",
					"rem_sleep_duration", "restless_periods", "sleep_phase_5_min", "movement_30_sec",
					"readiness_score_delta", "sleep_score_delta", "light_sleep_duration", "low_battery_alert",
					"period", "readiness", "bedtime_end", "bedtime_start", "hrv", "type"], 
					inplace=True, errors='ignore')

	# Merge the two
	sleep_df = pd.merge(df, df2, how="inner", on="day", left_index=False, right_index=False)
	sleep_df.rename(columns={"latency":"onset_latency", "total_sleep_duration":"duration"}, inplace=True)

	sleep_df["duration"] = sleep_df["duration"] / 60 # convert to minutes
	sleep_df["onset_latency"] = sleep_df["onset_latency"] / 60 # convert to minutes

	sleep_df.set_index('day', inplace=True)

	# rename all column names to prepend the type of data; makes figuring out later easier when all combined
	# if activity is already in the column, don't need to worry about it
	for column in sleep_df.columns.values:
		if not (dataType in column):
			sleep_df.rename(columns={column: dataType + "_" + column}, inplace=True, errors="raise")

	sleep_df.fillna(0)

	return sleep_df

def getAllData(dataType, startDate, endDate, token):

	df = None
	first = True
	
	# Can't aggregate workouts into the chart for "all" data; could be many workouts per day
	# @todo maybe a "has_workout" boolean column?
	
	dataFunctions = {
		"activity": getDailyDataV2, 
		"heartrate": getDailyDataV2, 
		"sleep": getSleepDataV2, 
		"readiness": getDailyDataV2
	}

	for activity in dataFunctions.keys():

		activityData = None
		if activity == "heartrate":
			activityData = getHRData(startDate, endDate, token)
		else:
			activityData = dataFunctions[activity](activity, startDate, endDate, token)

		if (first):
			first = False
			df = activityData
			
		else:
			df = pd.concat([df, activityData], axis=1, join='outer')
	
	df = df.fillna(0)

	return df    


'''
# Error message documentation from the OuraAPI

{
	"status": 400,
	"title": "something is wrong",
	"detail": "This provides more information"  
}

2xx: Successful request.
4xx: There was some problem with your request.
5xx: Server error.

200 OK	Successful Response
400 Query Parameter Validation Error	The request contains query parameters that are invalid or incorrectly formatted.
426 Minimum App Version Error	The Oura user's mobile app does not meet the minimum app version requirement to support sharing the requested data type. The Oura user 
must update their mobile app to enable API access for the requested data type.
429 Request Rate Limit Exceeded	The API is rate limited to 5000 requests in a 5 minute period. You will receive a 429 error code if you exceed this limit. Contact us 
if you expect your usage to exceed this limit.
'''

parser = argparse.ArgumentParser()

parser.add_argument('-token', type = str, required = False, help='Oura personal access token (required)')
parser.add_argument('-interval', type = int, required = False, help='Number of unit to query data (required)')
parser.add_argument('-unit', type = str, required = False, help='Unit to use [months, days, weeks] to query data (required)')
parser.add_argument('-activity', type = str, required = False, help='Which activity to get (required)\nOne of: \n\t[activity, sleep, readiness]')

args = parser.parse_args()

pat = args.token
interval_num = args.interval
interval_unit = args.unit
activity = args.activity

activities = ["activity", "heartrate", "sleep", "readiness", "all"] # removed workouts

# Removed the required = True from the add_argument in order to be able to flush the stdout after error
# do some argument checking here
if (not pat or not interval_num or not interval_unit or not activity or not activities.__contains__(activity)):
	print("Invalid arguments.")

	print('\t -token=<token> \t (str) Oura personal access token (required)')
	print('\t -interval=<interval> \t (int) Number of unit to query data (required)')
	print('\t -unit=<unit> \t (str) Unit to use with interval, one of [months, days, weeks] (required)')
	print('\t-activity=<activity> \t (str) Which activity to get, one of [activity, sleep, readiness, heartrate, all] (required)')

	sys.stdout.flush()
	exit(-1)

# grab all your data

# get today in the format that Oura expects
dateformat = "%Y-%m-%d"

# Get today (default end date)
today = date.today()
#todaystr = today.strftime(dateformat)


months = 0
days = 0

if interval_unit == "months":
	months = interval_num
elif interval_unit == "days":
	days = interval_num
elif interval_unit == "weeks":
	days = interval_num * 7
else:
	#default to days for interval
	days = interval_num

# get Start date based on range of months, add extra day to make date range inclusive of both ends

startdate = today - relativedelta(months=months, days=days) # + 1)
startdatestr = startdate.strftime(dateformat)

enddate = today #- relativedelta(days = 1)
enddatestr = enddate.strftime(dateformat)

# Align requested data to appropriate function based on Oura's API
dataFunctions = {
	"activity": getDailyDataV2, 
	#"workouts": getDailyDataV2, @TODO fix this or remove; the charting doesn't support a workout chart yet
	"heartrate": getDailyDataV2, 
	"sleep": getSleepDataV2, 
	"readiness": getDailyDataV2,
	"all": getAllData
}

activityData = None

if activity == "heartrate":
	activityData = getHRData(startdatestr, enddatestr, pat)
else:
	activityData = dataFunctions[activity](activity, startdatestr, enddatestr, pat)

# some debug statements
#print(activityData.info())
#print(activityData)
#print(activityData.describe)

# print data in a way that nodejs can easily ingest
print(activityData.to_json(orient="columns"))
sys.stdout.flush()
