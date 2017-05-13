const Promise = require('bluebird');
const requestWithJWT = Promise.promisify(require('google-oauth-jwt').requestWithJWT());
const qs = require('querystring');
class CalendarAPI {

	constructor(config) {
		this._JWT = {
			email: config.serviceAcctId,
			scopes: ['https://www.googleapis.com/auth/calendar']
		};
		if (config.keyFile !== undefined) {			//for using pem key
			this._JWT.keyFile = config.keyFile;
		} else if (config.key !== undefined) {		//for using json key
			this._JWT.key = config.key;
		} else {
			throw new Error('Missing keyfile for Google OAuth; Check if defined in Settings file');
		}
		this._TIMEZONE = config.timezone;
	}

	_checkCalendarId(calendarId, errorOrigin) {
		if (calendarId === undefined || calendarId == '') {
			throw new Error(errorOrigin + ': Missing calendarId argument; Check if defined in params and Settings file');
		}
	}

	_request(calendarId, params) {
		// todo: need better validation
		this._checkCalendarId(calendarId);
		if (params === undefined) {
			throw new Error('Missing argument; query terms needed');
		}

		let options = {
			url: 'https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events',
			jwt: this._JWT,
			qs: params,
			useQuerystring: true
		};

		return requestWithJWT(options);
	}

	/**
	 * Returns a promise that list all events on calendar during selected period
	 * 
	 * @param {string} calendarId - Calendar identifier
	 * @param {datetime} timeMin (optional) - start datetime of event in 2016-04-29T14:00:00+08:00 RFC3339 format
	 * @param {datetime} timeMax (optional) - end datetime of event in 2016-04-29T18:00:00+08:00 RFC3339 format
	 * @param {string} q (optional) - Free text search terms to find events that match these terms in any field, except for extended properties. 
	 * More Optional query parameters @ https://developers.google.com/google-apps/calendar/v3/reference/events/list
	 */
	listEvents(calendarId, params) {
		this._checkCalendarId(calendarId, 'listEvents Error');

		return this._request(calendarId, params).then(resp => {
			if (resp.statusCode !== 200) {
				throw new Error(resp.statusCode + ':\n' + resp.body);
			};

			let body = JSON.parse(resp.body);
			return body.items;
		}).catch(err => {
			throw new Error('ListEvents Error: ' + err);
		});
	}

	/**
	 * Insert an event on the user's primary calendar. Returns promise of details of booking
	 *
	 * @param {string} eventSummary - Name to be specified in calendar event summary
	 * @param {string} startDateTime - start datetime of event in 2016-04-29T14:00:00+08:00 format
	 * @param {string} endDateTime - end datetime of event in 2016-04-29T18:00:00+08:00 format
	 * @param {string} location - Location description of event
	 * @param {string} status - event status - confirmed, tentative, cancelled; tentative for all queuing
	 */
	insertEvent(calendarId, eventSummary, startDateTime, endDateTime, location, status, description, colour) {
		this._checkCalendarId(calendarId);
		let event = {
			"start": {
				"dateTime": startDateTime
			},
			"end": {
				"dateTime": endDateTime
			},
			"location": location,
			"summary": eventSummary,
			"status": status,
			"description": description,
			"colorId": colour,
		};

		let options = {
			method: 'POST',
			url: 'https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events',
			json: true,
			body: event,
			jwt: this._JWT
		};

		return requestWithJWT(options).then(resp => {

			if (resp.statusCode !== 200) {
				throw new Error(resp.statusCode + ':\n' + resp.body);
			};
			return resp;

		})
			.catch(err => {
				throw err;
			});
	}

	deleteEvent(calendarId, eventId) {
		this._checkCalendarId(calendarId);
		if (eventId === undefined) {
			throw new Error('Missing argument; need to pass in eventId');
		}

		return requestWithJWT({
			method: 'DELETE',
			url: 'https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events/' + eventId,
			jwt: this._JWT
		}).then(resp => {
			if (resp.statusCode !== 204) {
				throw new Error(resp.statusCode + ':\n' + resp.body);
			}
			let status = resp.statusCode;

			return { statusCode: status, message: 'Event delete success' };
		})
			.catch(err => {
				throw err;
			});
	}

	/**
	 * Checks when queried calendar is busy/ during selected period.
	 * Returns promise of list of start and end timings that are busy with time range.
	 *
	 * @param {string} startDateTime - start datetime of event in 2016-04-29T14:00:00+08:00 format
	 * @param {string} endDateTime - end datetime of event in 2016-04-29T18:00:00+08:00 format
	 */
	checkBusyPeriod(calendarId, startDateTime, endDateTime) {
		this._checkCalendarId(calendarId);
		let event = {
			"timeMin": startDateTime,
			"timeMax": endDateTime,
			"timeZone": this._TIMEZONE,
			"items": [{ "id": calendarId }]
		};

		let options = {
			method: 'POST',
			url: 'https://www.googleapis.com/calendar/v3/freeBusy',
			json: true,
			body: event,
			jwt: this._JWT
		};

		return requestWithJWT(options).then(resp => {
			return resp.body.calendars[calendarId].busy;
		})
			.catch(err => {
				throw err;
			});
	}
}

module.exports = CalendarAPI;