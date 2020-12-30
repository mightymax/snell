var express = require('express');
var router = express.Router();
var db = require("../database.js")
var shajs = require('sha.js')
var createError = require('http-errors');
var Been = require("../models/Been.js");

var model;

var routePatternCountry = '/been/country/:id([A-Z]{2})';
var routePatternRegion = '/been/region/:country([A-Z]{2})-:id([A-Z0-9]{2})';

// middleware to fetch user
router.use(function user (req, res, next) {
  var passwd = shajs('sha256').update('snell').digest('hex');
  db.get("SELECT email, name FROM user WHERE password=?", [passwd], (err, user) => {
    if (err) {
      return next(createError('InternalServerError', err.message));
    } else if (!user) {
      return next(createError('Unauthorized'));
    } else {
      model = new Been(user);
      next();
    }
  });
})

router.get(routePatternCountry, function (req, res, next) {
  model.country.load(req.params.id, function (err, country) {
    if (err) return next(createError('InternalServerError', err.message));
    if (!country.has('id')) return next(createError(404, `country '${req.params.id}' not found`));
    res.json(country);
  });

});

router.get(routePatternRegion, function (req, res, next) {
  model.region.load(req.params.country + '-' + req.params.id, function (err, region) {
    if (err) return next(createError('InternalServerError', err.message));
    if (!region.has('id')) return next(createError(404, `region '${req.params.country}-${req.params.id}' not found`));
    res.json(region);
  });
});

router.get(['/been', '/been/countries'], (req, res, next) => {
  model.countries(function(err, countries) {
    if (err) {
      return next(createError('InternalServerError', err.message));
    }
    res.json(countries);
  })
});

router.get(['/been/regions(/:countryId([a-z]{2}))?'], (req, res, next) => {
  model.regions(req.params.countryId, function(err, regions) {
    if (err) {
      return next(createError('InternalServerError', err.message));
    }
    if ((!regions || regions.length == 0)  && req.params.countryId) {
      return next(createError(404, `regions for country '${req.params.countryId}' not found`));
    }
    res.json(regions);
  });
});

router.delete(routePatternCountry, function (req, res, next) {
  model.country.load(req.params.id, function (err, country) {
    if (!country.has('id')) return next(createError(404, `country '${req.params.id}' not found`));
    country.delete(function(err, country) {
      if (err) {
        return next(createError('InternalServerError', err.message));
      }
      res.json(country);
    });
  });
});

router.delete(routePatternRegion, function (req, res, next) {
  model.region.load(req.params.country + '-' + req.params.id, (err, region) => {
    if (err) return next(createError('InternalServerError'));
    if (!region.has('id')) return next(createError(404, `region '${req.params.country}-${req.params.id}' not found`));
    region.delete((err, region) => {
      if (err) return next(createError('InternalServerError', err.message));
      res.json(region);
    })
  });
});

router.post(routePatternCountry, function (req, res, next) {
  model.country.clear();
  model.country.set('id', req.params.id).save((err, country) => {
    if (err) {
      return next(createError('InternalServerError', err.message));
    }
    res.json(country);
  });
});

router.post(routePatternRegion, function (req, res, next) {
  model.country.clear();
  model.country.set('id', req.params.country).save((err, country) => {
    if (err) {
      return next(createError('InternalServerError', err.message));
    }
    model.region.clear();
    model.region.set('id', country.get('id') + '-' + req.params.id).set('country', req.params.country).save((err, region) => {
      if (err) {
        return next(createError('InternalServerError', err.message));
      }
      res.json(region);
    });
  });
});

router.get('/world', (req, res, next) => {
  model.allCountries((countries) => {
    res.json(countries);
  })
})

router.get('/world/:countryId([a-z]{2})/regions', (req, res, next) => {
  model.allRegions(req.params.countryId, (regions) => {
    if (!regions) return next(createError(404, `regions for country '${req.params.countryId}' not found`));
    res.json(regions);
  })
})

module.exports = router;
