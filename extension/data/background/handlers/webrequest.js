'use strict';

/**
 * Retrieves the user's OAuth tokens from cookies.
 * @param {number} [tries=1] Number of tries to get the token (recursive)
 * @returns {Promise<Object>} An object with properties `accessToken`,
 * `refreshToken`, `scope`, and some others
 */
async function getOAuthTokens (tries = 1) {
    // This function will fetch the cookie and if there is no cookie attempt to create one by visiting modmail.
    // http://stackoverflow.com/questions/20077487/chrome-extension-message-passing-response-not-sent

    // Grab the current token cookie
    const cookieInfo = {url: 'https://mod.reddit.com', name: 'token'};
    let rawCookie;
    try {
        rawCookie = await browser.cookies.get(cookieInfo);
    } catch (error) {
        // If first-party isolation is enabled in Firefox, `cookies.get`
        // throws when not provided a `firstPartyDomain`, so we try again
        // passing the first-party domain for the cookie we're looking for.
        cookieInfo.firstPartyDomain = 'reddit.com';
        rawCookie = await browser.cookies.get(cookieInfo);
    }

    // Make sure the cookie is still valid
    let validCookie = false;
    if (rawCookie) {
        const cookieExpiration = rawCookie.expirationDate * 1000;
        const timeNow = Date.now();
        // The cookie is valid if it's younger than its expiration date
        validCookie = timeNow < cookieExpiration;
    }

    // If we have a valid cookie, get the tokens from it and return those
    if (validCookie) {
        // The cookie we grab has a base64 encoded string with data. Sometimes is invalid data at the end.
        // This RegExp should take care of that.
        const base64Cookie = rawCookie.value.replace(/[^A-Za-z0-9+/].*?$/, '');
        const tokenData = atob(base64Cookie);
        return JSON.parse(tokenData);
    }

    // If we don't have a valid cookie, we need to generate a new one. If the user
    // is logged in, we can do this by sending a request to the modmail page, and
    // it'll send back a new cookie that the browser will write for us. We'll then
    // be able to read the new cookie and all is well, without having to deal with
    // the Reddit OAuth flow ourselves.
    if (tries < 3) {
        await makeRequest({
            endpoint: 'https://mod.reddit.com/mail/all',
            absolute: true,
        });
        return getOAuthTokens(tries + 1);
    } else {
        // If we tried that 3 times and still no dice, the user probably isn't logged
        // into modmail, which means this trick won't work. Prompt the user to log
        // into modmail so we can get their token.
        throw new Error('user not logged into new modmail');
    }
}

/**
 * Serializes a fetch `Response` to a JSON value that can be constructed into a
 * new `Response` later.
 * @param {Response} response
 * @returns {Promise<array | undefined>} An array of arguments to the `Response`
 * constructor, serializable to plain JSON, which can be used to replicate the
 * given response.
 */
async function serializeResponse (response) {
    const headers = {};
    for (const [header, value] of response.headers) {
        headers[header] = value;
    }
    return [await response.text(), {
        status: response.status,
        statusText: response.statusText,
        headers,
    }];
}

/**
 * Creates a URL query string from the given parameters.
 * @function
 * @param {object} parameters An object of parameters
 * @returns {string}
 */
function queryString (parameters) {
    if (!parameters) {
        return '';
    }
    const kvStrings = [];
    for (const [k, v] of Object.entries(parameters)) {
        if (v !== undefined && v !== null) {
            kvStrings.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
        }
    }
    if (!kvStrings.length) {
        return '';
    }
    return `?${kvStrings.join('&')}`;
}

/**
 * Creates a `FormData` object from the given set of key-value pairs.
 * @param {object} obj
 * @returns {FormData}
 */
function makeFormData (obj) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(obj)) {
        if (value != null) {
            formData.append(key, value);
        }
    }
    return formData;
}

/**
 * Sends a generic HTTP request.
 * @function
 * @param {object} options The options for the AJAX request
 * @param {string} [options.method] The HTTP method to use for the request
 * @param {string} options.endpoint The endpoint to request
 * @param {object} [options.query] Query parameters as an object
 * @param {string} [options.body] Body to send with a POST request, serialized
 * as JSON if not a string
 * @param {boolean?} [options.oauth] If true, the request will be sent on
 * oauth.reddit.com, and the `Authorization` header will be set with the
 * OAuth access token for the logged-in user
 * @param {boolean?} [options.okOnly] If true, non-2xx responses will result
 * in an error being rejected. The error will have a `response` property
 * containing the full `Response` object.
 * @returns {Promise} Resolves to a Response object, or rejects an Error
 * @todo Ratelimit handling
 */
async function makeRequest ({method, endpoint, query, body, oauth, okOnly, absolute}) {
    query = queryString(query);
    // If we have a query object and additional parameters in the endpoint, we
    // just stick the object parameters on the end with `&` instead of `?`, and
    // duplicate keys in the final URL are fine (consistent with jQuery)
    if (endpoint.includes('?')) {
        query = query.replace('?', '&');
    }
    const url = absolute ? endpoint : `https://${oauth ? 'oauth' : 'old'}.reddit.com${endpoint}${query}`;
    const options = {
        credentials: 'include', // required for cookies to be sent
        redirect: 'error', // prevents strange reddit API shenanigans
        method,
        cache: 'no-store',
    };

    // Post requests need their body to be in formdata format
    if (body) {
        if (typeof body === 'object') {
            // If the body is passed as an object, convert it to a FormData object
            options.body = makeFormData(body);
        } else {
            // Otherwise, we assume the body is a string and use it as-is
            options.body = body;
        }
    }

    // If requested, fetch OAuth tokens and add `Authorization` header
    if (oauth) {
        try {
            const tokens = await getOAuthTokens();
            options.headers = {Authorization: `bearer ${tokens.accessToken}`};
        } catch (error) {
            console.error('getOAuthTokens: ', error);
            throw error;
        }
    }

    // Perform the request
    let response;
    try {
        response = await fetch(url, options);
    } catch (error) {
        console.error('Fetch request failed:', error);
        throw error;
    }

    // `okOnly` means we should throw if the response has a non-2xx status
    if (okOnly && !response.ok) {
        const error = new Error('Response returned non-2xx status code');
        error.response = response;
        throw error;
    }

    // Otherwise return the raw response
    return response;
}

// Makes a request and sends a reply with response and error properties
messageHandlers.set('tb-request', requestOptions => makeRequest(requestOptions).then(
    // For succeeded requests, we send only the raw `response`
    async response => ({response: await serializeResponse(response)}),
    // For failed requests, we send:
    // - `error: true` to indicate the failure
    // - `message` containing information about the error
    // - `response` containing the raw response data (if applicable)
    async error => ({
        error: true,
        message: error.message,
        response: error.response ? await serializeResponse(error.response) : undefined,
    }),
));
