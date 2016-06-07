/**
 *
 * @param sails
 */
module.exports = function (sails) {
	return (function () {
		function initialize(cb) {
			sails.log.debug("sails-hook-exceptor on the way");

			cb();
		}

		var _this = {
			initialize: initialize,
		};

		return _this;
	})();
}

module.exports.loadMiddleware = function theMiddlewareLoader(app, fns, sails) {
	sails.log.debug("Exceptor is in the war!");

	app.use(function forResponseMethod(req, res, next) {
		res.exceptor = _.bind(function (data) {
			var res = this.res,
				statusCode = 500;

			if(_.has(data, 'toJSON'))
				data = data.toJSON();

			try {
				statusCode = data.status || 500;
				res.status(statusCode);
			} catch (e) {
			}

			if (statusCode === 403) return res.status(403).json(data);
			if (statusCode === 404) return res.status(404).json(data);
			if (statusCode >= 400 && statusCode < 500) return res.status(400).json(data);
			return res.status(500).json(data);
		}, {
			req: req,
			res: res
		});

		next();
	});
	_.each(sails.config.http.middleware.order, function (middlewareKey) {
		if (middlewareKey == '500') {
			app.use(function for500(err, req, res, next) {
				try {
					sails.log.error("custom 500", _.keys(err));
					res.status(500).json({
						error: 'E_UNKNOWN',
						status: 500,
						summary: "Something bad occured, could you try again ?"
					});
				} catch (e) {
					sails.log.error("Can't send the server error, some error occured while sending:");
					sails.log.error(e);
				}
			});
			return;
		}

		// `$custom` is a special entry in the middleware order config that exists
		// purely for compatibility.  When procesing `$custom`, we check to see if
		// `sails.config.http.customMiddleware`, was provided and if so, call it
		// with the express app instance as an argument (rather than calling
		// `sails.config.http.middleware.$custom`).
		// If `customMiddleware` is not being used, we just ignore `$custom` altogether.
		if (middlewareKey === '$custom') {
			if (sails.config.http.customMiddleware) {
				// Allows for injecting a custom function to attach middleware.
				// (This is here for compatibility, and for situations where the raw Express
				//  app instance is necessary for configuring middleware).
				sails.config.http.customMiddleware(expressApp);
			}
			// Either way, bail at this point (we don't want to do anything further with $custom)
			return;
		}

		// Look up the referenced middleware function.
		var referencedMwr = fns[middlewareKey];

		// If a middleware fn by this name is not configured (i.e. `undefined`),
		// then skip this entry & write a verbose log message.
		if (_.isUndefined(referencedMwr)) {
			sails.log.verbose('An entry (`%s`) in `sails.config.http.middleware.order` references an unrecognized middleware function-- that is, it was not provided as a key in the `sails.config.http.middleware` dictionary. Skipping...', middlewareKey);
			return;
		}
		// On the other hand, if the referenced middleware appears to be disabled
		// _on purpose_, or because _it is not compatible_, then just skip it and
		// don't log anything. (i.e. it is `null` or `false`)
		if (!referencedMwr) {
			return;
		}

		// Otherwise, we're good to go, so go ahead and use the referenced
		// middleware function.
		app.use(referencedMwr);

	});
};