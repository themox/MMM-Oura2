#!/usr/bin/python3

import requests
import json
import hashlib
import pandas as pd
import numpy as np
import sys

from datetime import datetime, date
from dateutil.relativedelta import relativedelta

###############
# Full API documentation at https://cloud.ouraring.com/docs
###############

import argparse
parser = argparse.ArgumentParser()

parser.add_argument('-token', type = str, required = False, help='Oura personal access token (required)')
parser.add_argument('-interval', type = int, required = False, help='Number of unit to query data (required)')
parser.add_argument('-unit', type = str, required = False, help='Unit to use [months, days, weeks] to query data (required)')
parser.add_argument('-activity', type = str, required = False, help='Which activity to get (required)\nOne of: \n\t[activity, workouts, sleep, readiness]')

args = parser.parse_args()

pat = args.token
interval_num = args.interval
interval_unit = args.unit
activity = args.activity

activities = ["activity", "workouts", "heartrate", "sleep", "readiness", "all"]


# Removed the required = True from the add_argument in order to be able to flush the stdout after error
# do some argument checking here
if (not pat or not interval_num or not interval_unit or not activity or not activities.__contains__(activity)):
	print("Invalid arguments.")

	print('\t -token=<token> \t (str) Oura personal access token (required)')
	print('\t -interval=<interval> \t (int) Number of unit to query data (required)')
	print('\t -unit=<unit> \t (str) Unit to use with interval, one of [months, days, weeks] (required)')
	print('\t-activity=<activity> \t (str) Which activity to get, one of [activity, workouts, sleep, readiness, heartrate, all] (required)')

	sys.stdout.flush()
	exit(-1)

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

def getDailyDataV2(dataType, startDate, endDate, token):

	okTypes = ["activity", "workouts"]
	url = ""
	dropColumns = []
	params = {}

	# assume startDate and endDate are correctly formatted
	# @todo add error checking for that
	if not okTypes.__contains__(dataType):
		# @todo error!
		return None
		pass

	# Construct the V2 API URL
	# DailyActivity
	if dataType == "activity":
		url = 'https://api.ouraring.com/v2/usercollection/daily_activity' 

		# See response schema at Oura's website: https://cloud.ouraring.com/v2/docs#operation/daily_activity_route_daily_activity_get
		dropColumns = ["class_5_min", "average_met_minutes", "contributors", "equivalent_walking_distance", "high_activity_met_minutes",
		"high_activity_time", "inactivity_alerts", "low_activity_met_minutes", "low_activity_time", "medium_activity_met_minutes",
		"medium_activity_time", "meters_to_target", "non_wear_time", "resting_time",  "sedentary_met_minutes", "sedentary_time",
		"target_calories", "target_meters", "timestamp", "met"]

		# Keep columns: score, active_calories, steps, total_calories, day		

	elif dataType == "workouts":
		url = 'https://api.ouraring.com/v2/usercollection/workout' 

		# see response schema at Oura's website: https://cloud.ouraring.com/v2/docs#operation/workouts_route_workout_get
		dropColumns = ['end_datetime', 'source', 'start_datetime', 'distance']

		# Keep Columns: day, activity, calories, intensity

	else: 
		# @todo error!
		pass

	# Search parameters
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


# Not all available data has been ported over to the V2 API
# @todo watch the Oura API (says early '23') for when this moves over, will be a breaking change
def getDailyDataV1(dataType, startDate, endDate, token):
	okTypes = ["sleep", "readiness"]
	dropColumns = []
	
	# assume startDate and endDate are correctly formatted
	# @todo add error checking for that
	if not okTypes.__contains__(dataType):
		# @todo error!
		return None

	# Not all columns need to be passed to the calling API, too much data for a high level infographic
	# But not possible to *not* get it through Oura's API, so just drop it here using Pandas functions

	if dataType == "sleep":
		# See Oura's API for a description of each field: https://cloud.ouraring.com/docs/sleep
		dropColumns = ["period_id", "is_longest", "timezone", "score_total", "score_disturbances", "score_efficiency", "bedtime_start",
		"bedtime_end", "score_latency", "score_rem", "score_deep", "score_alignment", "total", "awake", "light", "rem", "deep", "restless",
		"midpoint_time", "hr_lowest", "hr_average", "rmssd", "breath_average", "temperature_delta", "hypnogram_5min", "hr_5min", "rmssd_5min",
		# The following fields are in the data but not documented in Oura's API, unclear of units, etc.
		"temperature_deviation", "temperature_trend_deviation", "bedtime_start_delta", "bedtime_end_delta", "midpoint_at_delta"]

		# Kept Columns: "summary_date", "score", "efficiency", "hr_average", "onset_latency", "duration"

	elif dataType == "readiness":
		# See Oura's API for a description of each field: https://cloud.ouraring.com/docs/readiness
		dropColumns = ["period_id", "score_previous_night", "score_sleep_balance", "score_previous_day", 
		"score_activity_balance", "score_resting_hr", "score_temperature", "rest_mode_state"]

		# Kept Columns: summary_date, score, score_hrv_balance, score_recovery_index

	#DailySleep
	# https://api.ouraring.com/v1/sleep?start=YYYY-MM-DD&end=YYYY-MM-DD

	#DailyReadiness
	# https://api.ouraring.com/v1/readiness?start=YYYY-MM-DD&end=YYYY-MM-DD

	# Construct the v1 api URL
	url = "https://api.ouraring.com/v1/" + dataType

	params={
		'start': startDate,
		'end': endDate
	}

	headers = {
		'Authorization': 'Bearer ' + token
	}

	response = requests.request('GET', url, headers=headers, params=params)

	# @todo error checking on  the response

	df = pd.DataFrame(response.json()[dataType])

	# Drop extra columns we're not going to use so we're not passing all that data back and forth
	# Easy enough to come in here later and fix it if we want to use them
	df.drop(columns=dropColumns, inplace=True, errors='ignore')

	# rename column
	df.rename(columns={"summary_date": "day"}, inplace=True, errors="raise")
	df.set_index('day', inplace=True)

	if dataType == "sleep":
		df["duration"] = df["duration"] / 60 # convert to minutes
		df["onset_latency"] = df["onset_latency"] / 60

	# rename all column names to prepend the type of data; makes figuring out later easier when all combined
	# if activity is already in the column, don't need to worry about it
	for column in df.columns.values:
		if not (dataType in column):
			df.rename(columns={column: dataType + "_" + column}, inplace=True, errors="raise")

	df = df.fillna(0)
	
	return df

def getAllData(dataType, startDate, endDate, token):

	df = None
	first = True
	
	# Can't aggregate workouts into the chart for "all" data; could be many workouts per day
	# @todo maybe a "has_workout" boolean column?
	
	dataFunctions = {
		"activity": getDailyDataV2, 
		"heartrate": getDailyDataV2, 
		"sleep": getDailyDataV1, 
		"readiness": getDailyDataV1
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
426 Minimum App Version Error	The Oura user's mobile app does not meet the minimum app version requirement to support sharing the requested data type. The Oura user must update their mobile app to enable API access for the requested data type.
429 Request Rate Limit Exceeded	The API is rate limited to 5000 requests in a 5 minute period. You will receive a 429 error code if you exceed this limit. Contact us if you expect your usage to exceed this limit.
'''

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
startdate = today - relativedelta(months=months, days=days + 1)
startdatestr = startdate.strftime(dateformat)

enddate = today #- relativedelta(days = 1)
enddatestr = enddate.strftime(dateformat)

# Align requested data to appropriate function based on Oura's API
dataFunctions = {
	"activity": getDailyDataV2, 
	"workouts": getDailyDataV2,
	"heartrate": getDailyDataV2, 
	"sleep": getDailyDataV1, 
	"readiness": getDailyDataV1,
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
