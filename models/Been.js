var countries = require("@amcharts/amcharts4-geodata/json/data/countries2.json");

var model = class Been {
    constructor(user) {
        this.db = require("../database.js");

        this.user = user;
        this.country = new Country(this);
        this.region = new Region(this);
    }

    countries(next) {
        var sql = `
        SELECT countries.id AS country, GROUP_CONCAT(regions.id) AS regions
        FROM countries
        LEFT JOIN regions ON countries.id=regions.country AND regions.user=countries.user
        WHERE countries.user = ?
        GROUP BY countries.id
        ORDER BY countries.id`
          
        this.db.all(sql, [this.user.email], (err, rows) => {
            next(err, rows);
        });
    }

    allCountries(next) {
        next(countries);
    }

    allRegions(countryId, next) {
        var country = countries[countryId]
        if (!country) return next (new Error(`country '${this.get('id')}' not found`), this);
        if (!country.maps || country.maps.length == 0) {
            return next (new Error(`country '${this.get('country')}' has no regions`), this);
        }
        let map = country.maps[0];
        next(require(`@amcharts/amcharts4-geodata/json/${map}.json`));
    }

    regions(countryId, next) {
        if (countryId) {
            var sql = `SELECT id, country FROM regions WHERE user=? AND country=? ORDER BY id`;
            var params = [this.user.email, countryId.toUpperCase()]
        } else {
            var sql = `SELECT id, country FROM regions WHERE user=? ORDER BY id`;
            var params = [this.user.email]
        }
        this.db.all(sql, params, (err, rows) => {
            next(err, rows)
        });
    }

}
class base extends Map {
    constructor(model, tablename, primarykeys) {
        super();
        this.tablename = tablename;
        this.model = model;
        this.set('user', this.model.user.email);
        this.primarykeys = ['id', 'user'].concat(primarykeys ? primarykeys : []);
    }

    load(id, next) {
        this.clear();
        id = id.toUpperCase();
        this.model.db.get(`SELECT * FROM ${this.tablename} WHERE user = ? AND id = ?`, [this.model.user.email, id.toUpperCase()], (err, row) => {
            for (var field in row) {
                this.set(field, row[field]);
            }
            next(err, this);
        });
    }
    
    clear() {
        super.clear();
        this.set('user', this.model.user.email);
    }

    set(key, val) {
        if (key == 'id') val=val.toUpperCase();
        return super.set(key, val);
    }

    validate(next) {
        var errors = [];
        for (var i in this.primarykeys) {
            let key = this.primarykeys[i]; 
            if (!this.has(key)) {
                return next(new Error(`missing primary key '${key}'`), this);
            }
        }
        next(null, this);
    }

    save(next) {
        this.validate((err, self) => {
            if (err) {
                return next(err, this);
            }
            let values = [];
            let qs = [];
            for (var i in this.primarykeys) {
                let key = this.primarykeys[i]; 
                if (!this.has(key)) {
                    return next(new Error(`missing primary key '${key}'`), {});
                }
                values.push(this.get(key));
                qs.push('?');
            }
            let sql = `REPLACE INTO ${this.tablename} (${this.primarykeys.join(',')}) VALUES(${qs.join(',')})`;
            this.model.db.run(sql, values, (err) => {
                next(err, this);    
            });
    
        });
    }

    toJSON() {
        let clone = new Map(this)
        clone.delete('user');
        var result = {};
        clone.forEach(function(value, key) {
            result[key] = value instanceof base ? value.toArray() : value;
        });
        return result;
    }

    delete(next) {
        if (!this.has('id')) {
            next(new Error("Record not loaded"), this);
        }
        this.model.db.run(`DELETE FROM ${this.tablename} WHERE user= ? AND id = ?`,[this.get('user'), this.get('id')], (err) => {
            next(err, this);
        });
    }

}

class Country extends base {
    constructor(model) {
        super(model, 'countries');
    }

    load(id, next) {
        super.load(id, function(err, self) {
            if (err || !self.has('id')) {
                return next(err, self)
            }
            if (!countries[self.get('id')]) return next (new Error(`country '${self.get('id')}' not found`), self);
            self.set('feature', countries[this.get('id')]);
            self.regions = self.getRegions(function(err, regions) {
                self.set('regions', regions);
                next(err, self);
            });
        });
    }

    validate(next)
    {
        super.validate((err, self) => {
            if (err) next(err, self);
            if (!countries[this.get('id')]) return next (new Error(`country '${this.get('id')}' not found`), this);
            this.set('feature', countries[this.get('id')]);
            next(null, this);
        });

    }

    getRegions(next) {
        if (!this.has('id')) {
            return next({});
        }
        this.model.regions(this.get('id'), function(err, regions) {
            next(err, regions);
        });
    }

    delete(next) {
        this.deleteRegions((err, self) => {
            if (err) return next(err, self);
            super.delete((err, self) => {
                next(err, self);
            });
        })
    }

    deleteRegions(next) {
        this.model.db.run("DELETE FROM regions WHERE user = ? AND country = ?", [this.get('user'), this.get('id')], (err) => {
            next(err, this);
        });
    }
    
}
class Region extends base {
    constructor(model) {
        super(model, 'regions', ['country']);
    }

    validate(next) {
        super.validate((err, self) => {
            if (err) next(err, self);
            let country = countries[this.get('country')];
            if (!country) return next (new Error(`country '${this.get('id')}' not found`), this);
            if (!country.maps || country.maps.length == 0) {
                return next (new Error(`country '${this.get('country')}' has no regions`), this);
            }
            let map = country.maps[0];
            
            let regions = require(`@amcharts/amcharts4-geodata/json/${map}.json`)
            for (var i in regions.features) {
                if (regions.features[i].id == this.get('id')) {
                    this.set('feature', regions.features[i]);

                    break;
                }
            }
            next(this.has('feature') ? null : new Error(`region '${this.get('id')}' not found`), this);
        });
    }

}

module.exports = model;
