/*
 * Copyright (C) 2016-2018 phantombot.tv
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
$(function() {
    var webSocket = getWebSocket(),
        queryMap = getQueryMap(),
        isPlaying = false,
        isDebug = localStorage.getItem('phantombot_alerts_debug') === 'true' || false;
        queue = [];

    /*
     * @function Gets a new instance of the websocket.
     *
     * @return {ReconnectingWebSocket}
     */
    function getWebSocket() {
        let socketUri = ((getProtocol() == 'https://' ? 'wss://' : 'ws://') + window.location.hostname + ':' + getPanelPort()), // URI of the socket.
            reconnectInterval = 5000; // How often in milliseconds we should try reconnecting.

        return new ReconnectingWebSocket(socketUri, null, {
            reconnectInterval: reconnectInterval
        });
    }

    /*
     * @function Parses the query params in the URL and puts them into a map.
     *
     * @return {Map}
     */
    function getQueryMap() {
        let queryString = window.location.search, // Query string that starts with ?
            queryParts = queryString.substr(1).split('&'), // Split at each &, which is a new query.
            queryMap = new Map(); // Create a new map for save our keys and values.

        for (let i = 0; i < queryParts.length; i++) {
            let key = queryParts[i].substr(0, queryParts[i].indexOf('=')),
                value = queryParts[i].substr(queryParts[i].indexOf('=') + 1, queryParts[i].length);

            if (key.length > 0 && value.length > 0) {
                queryMap.set(key, value);
            }
        }

        return queryMap;
    }

    /*
     * @function Prints debug logs.
     *
     * @param {String} message
     */
    function printDebug(message, force) {
        if (isDebug || force) {
            console.log('%c[Dungeon Log]', 'color: #6441a5; font-weight: 900;', message);
        }
    }

    /*
     * @function Toggles the debug mode.
     *
     * @param {String} toggle
     */
    window.toggleDebug = function(toggle) {
        localStorage.setItem('dungeon', toggle.toString());

        // Refresh the page.
        window.location.reload();
    }

    /*
     * @function Checks if the query map has the option, if not, returns default.
     *
     * @param  {String} option
     * @param  {String} def
     * @return {String}
     */
    function getOptionSetting(option, def) {
        if (queryMap.has(option)) {
            return queryMap.get(option);
        } else {
            return def;
        }
    }

    /*
     * @function Sends a message to the socket
     *
     * @param {String} message
     */
    function sendToSocket(message) {
        try {
            webSocket.send(JSON.stringify(message));
        } catch (ex) {
            printDebug('Failed to send a message to the socket: ' + ex.stack);
        }
    }

    /*
     * @function Handles the queue.
     */
    function handleQueue() {
        let event = queue[0];

        if (event !== undefined && isPlaying === false) {
            printDebug('Processing event ' + JSON.stringify(event));

            isPlaying = true;
            if (event.battleInfo !== undefined) {
                handleDungeonUpdate(event);
            }
            queue.splice(0, 1);
        }
    }

    /*
     * @function Handles GIF alerts.
     *
     * @param {Object} json
     */
    function handleDungeonUpdate(json) {
        let battleData = json.battleInfo,
			partyData,
            htmlObj = $('<div/>', {
                'html': battleData
            });
		
		//printDebug(battleData.combatLog[0]);
		
		let t = $('#battle-log');
		t.append(htmlObj);
		
		// mark as done
		isPlaying = false;

		// clear the screen
		setTimeout(() => {
			t.find(':first-child').fadeOut('slow').remove();
		}, 3e4);
    }

    /*
     * @event Called once the socket opens.
     */
    webSocket.onopen = function() {
        printDebug('Successfully connected to the socket.', true);
        // Authenticate with the socket.
        sendToSocket({
            authenticate: getAuth()
        });
    };

    /*
     * @event Called when the socket closes.
     */
    webSocket.onclose = function() {
        printDebug('Disconnected from the socket.', true);
    };

    /*
     * @event Called when we get a message.
     *
     * @param {Object} e
     */
    webSocket.onmessage = function(e) {
        try {
            let rawMessage = e.data,
                message = JSON.parse(rawMessage);

			console.log(message);
            printDebug('[MESSAGE] ' + rawMessage);

            if (message.query_id === undefined) {
                // Check for our auth result.
                if (message.authresult !== undefined) {
                    if (message.authresult === 'true') {
                        printDebug('Successfully authenticated with the socket.', true);
                    } else {
                        printDebug('Failed to authenticate with the socket.', true);
                    }
                } else

                    // Queue all events and process them one at-a-time.
                    if (message.battleInfo !== undefined) {
                        queue.push(message);
                    }

                // Message cannot be handled error.
                else {
                    printDebug('Failed to process message from socket: ' + rawMessage);
                }
            }
        } catch (ex) {
            printDebug('Failed to parse socket message [' + e.data + ']: ' + e.stack);
        }
    };
	
    // Handle processing the queue.
    setInterval(handleQueue, 5e2);
});
