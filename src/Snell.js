import "core-js/stable";
import "regenerator-runtime/runtime";
import * as am4core from "@amcharts/amcharts4/core";
import * as am4maps from "@amcharts/amcharts4/maps";
// import am4themes_animated from "@amcharts/amcharts4/themes/animated";
import am4geodata_worldLow from "@amcharts/amcharts4-geodata/worldLow";
import am4geodata_data_countries2 from "@amcharts/amcharts4-geodata/data/countries2";

const SnellDefaultConfig = {
    container: 'globe', 
    api: '/api',
    iconPath: 'icons'
}

var SnellConfig = (function () {
    var instance;
 
    function createInstance(userConfig) {
        const config = Object.assign(SnellDefaultConfig, window.hasOwnProperty('SnellGlobalConfig') ? window.SnellGlobalConfig : {}, userConfig);
        const keys = Object.keys(config);
        const map = new Map();
        for(let i = 0; i < keys.length; i++){
            map.set(keys[i], config[keys[i]]);
        };
        return map;
    }
 
    return {
        getInstance: function (userConfig) {
            if (!instance) {
                instance = createInstance(userConfig);
            } else if (userConfig && typeof userConfig == 'object') {
                const keys = Object.keys(userConfig);
                for(let i = 0; i < keys.length; i++){
                    instance.set(keys[i], userConfig[keys[i]]);
                };
            }
            return instance;
        }
    };
})();

class Snell {

    constructor(userConfig) {
        const config = SnellConfig.getInstance(userConfig);
        
        this.country = null;
        // am4core.useTheme(am4themes_animated);
        this.globe = am4core.create(config.get('container'), SnellGlobe).setSnell(this);
        this.globe.zoomControl = new SnellToolbar(this);

        this.countries = this.globe.series.push(new SnellCountries(this, function(ev) {
                ev.target.snell.been.datasource.load();
            })
         );
        this.regions = this.globe.series.push(new SnellRegions(this));
        this.been = new SnellBeenMapCountries(this);

        this.globe.reset();
    }

    static ready(calback) {
        return am4core.ready(calback);
    }

}

class SnellBeenMapApi extends XMLHttpRequest
{
    constructor() {
        super();
        this.apiUrl = SnellConfig.getInstance().get('api')+'/been';
    }

    save (obj, next) {
        return this.go('POST', obj, next)
    }

    delete (obj, next) {
        return this.go('DELETE', obj, next)
    }

    go(method, obj, next) {
        //Regions are not always loaded by MapPolygon, so dual way to handle these requests
        //We assume if obj is not an object, it is a region id! 
        if (typeof obj == 'string') {
            var id = obj;
            var objectType = 'region';
        } else {
            var id = obj.get('id');
            var objectType = SnellBeenMap.typeOf(obj);
        }
        
        var url =  this.apiUrl + `/${objectType}/${id}`;
        this.open(method, url);
        if (!next) next = function(){};
        this.onload = next;
        this.send();
    }

}

class SnellBeenMap extends Map {

    constructor() {
        super();
        this.api = new SnellBeenMapApi();
    }

    static isA(type, obj) {
        switch (type) {
            case 'country':
                return obj instanceof am4maps.MapPolygon && obj.series instanceof SnellCountries;
            case 'region':
                return obj instanceof am4maps.MapPolygon && obj.series instanceof SnellRegions;
            default:
                return false;
        }
    }

    static typeOf(obj) {
        if (SnellBeenMap.isA('country', obj)) return 'country';
        else if (SnellBeenMap.isA('region', obj)) return 'region';
        else return 'undefined';
    }

    setCountry (country) 
    {
        if (!country instanceof am4maps.MapPolygon) throw 'wrong argument: !instanceof am4maps.MapPolygon';
        if (!country.series instanceof SnellCountries) throw 'wrong argument: region !instanceof SnellCountries';
        this.api.save(country);

        return this.set(country.get('id'), new SnellBeenMapRegions())
    }

    deleteCountry(country) {
        if (!country instanceof am4maps.MapPolygon) throw 'wrong argument: !instanceof am4maps.MapPolygon';
        if (!country.series instanceof SnellCountries) throw 'wrong argument: region !instanceof SnellCountries';
        this.api.delete(country);
        return this.delete(country.get('id'));
    }

    getCountry(country) {
        if (!country instanceof am4maps.MapPolygon) throw 'wrong argument: !instanceof am4maps.MapPolygon';
        if (!country.series instanceof SnellCountries) throw 'wrong argument: region !instanceof SnellCountries';
        return this.get(country.get('id'));
    }

    hasCountry(country) {
        if (!country instanceof am4maps.MapPolygon) throw 'wrong argument: !instanceof am4maps.MapPolygon';
        if (!country.series instanceof SnellCountries) throw 'wrong argument: region !instanceof SnellCountries';
        return this.has(country.get('id'));
    }

}

class SnellBeenMapCountries extends SnellBeenMap
{
    constructor(snell)
    {
        super();
        this.datasource = new am4core.DataSource();
        this.datasource.url = SnellConfig.getInstance().get('api') + '/been';
        this.snell = snell;
        this.datasource.events.on("done", function(ev) {
            this.clear();
            var data = ev.data;
            var self = this;
            data.forEach(function(row){
                var regions = new SnellBeenMapRegions();
                if (row.regions) {
                    row.regions.split(',').forEach(function(regionId) {
                        regions.set(regionId, true);
                    });
                }
                self.set(row.country, regions);
                var country = self.snell.countries.getPolygonById(row.country);
                if (country) country.isActive = true;

            });
        }.bind(this));

        this.datasource.events.on("error", function(ev) {
            throw "failed to load Snell Data from API";
        });

    }

    set(key, val) {
        if (typeof val == 'undefined' && SnellBeenMap.isA('country', key)) {
            return this.setCountry(val);
        } 
        if (!val instanceof SnellBeenMapRegions) {
            throw 'wrong argument: SnellBeenMapCountries::set expects a SnellBeenMapRegions'
        }
        return super.set(key, val);
    }

    get(key) {
        if ( SnellBeenMap.isA('country', key)) {
            return this.getCountry(key);
        } 
        return super.get(key);
    }

    has(key) {
        if ( SnellBeenMap.isA('country', key)) {
            return this.hasCountry(key);
        } 
        return super.get(key);
    }

    delete(key) {
        if ( SnellBeenMap.isA('country', key)) {
            return this.deleteCountry(key);
        } 
        return super.delete(key);
    }

    setRegion(region) {
        if (typeof region == 'string') {
            var id = region;
        } else {
            if (!region instanceof am4maps.MapPolygon) throw 'wrong argument: !instanceof am4maps.MapPolygon';
            if (!region.series instanceof SnellRegions) throw 'wrong argument: region !instanceof SnellCountries';
            var id = region.get('id');
        }
        var countryId = SnellRegions.getCountryId(id);
        if (!this.has(countryId)) {
            var map = new SnellBeenMapRegions([id, true]);
            this.set(countryId, map);
            this.api.save(region);
            return map;
        } else {
            this.api.save(region);
            return this.get(countryId).set(id, true);
        }
    }

    deleteRegion (region) {
        if (typeof region == 'string') {
            var id = region;
        } else {
            if (!region instanceof am4maps.MapPolygon) throw 'wrong argument: !instanceof am4maps.MapPolygon';
            if (!region.series instanceof SnellRegions) throw 'wrong argument: region !instanceof SnellCountries';
            var id = region.get('id');
        }
        var countryId = SnellRegions.getCountryId(id);
        if (!this.has(countryId)) return false;
        this.api.delete(region);
        return this.get(countryId).delete(id);
    }
    
    hasRegion (region) {
        if (typeof region == 'string') {
            var id = region;
        } else {
            if (!region instanceof am4maps.MapPolygon) throw 'wrong argument: !instanceof am4maps.MapPolygon';
            if (!region.series instanceof SnellRegions) throw 'wrong argument: region !instanceof SnellCountries';
            var id = region.get('id');
        }
        var countryId = SnellRegions.getCountryId(id);
        if (this.has(countryId)) {
            return this.get(countryId).has(id);
        } else {
            return false;
        }
    }
    
    getRegion(region) {
        if (!region instanceof am4maps.MapPolygon) throw 'wrong argument: !instanceof am4maps.MapPolygon';
        if (!region.series instanceof SnellRegions) throw 'wrong argument: region !instanceof SnellCountries';
        var id = region.get('id');
        var countryId = SnellRegions.getCountryId(id);
        if (!this.hasRegion(region)) return;
        else return this.get(countryId).get(id);
    }

}

class SnellBeenMapRegions extends SnellBeenMap
{
    set(key, val) {
        if (typeof val == 'undefined' && SnellBeenMap.isA('region', key)) {
            key = this.getKey(key)
            val = true;
        } 
        if (typeof val != 'boolean') {
            throw 'wrong argument: SnellBeenMapRegions::set expects a Boolean'
        }
        return super.set(key, val);
    }

    get(key) {
        return super.get(this.getKey(key));
    }

    has(key) {
        return super.get(this.getKey(key));
    }

    delete(key) {
        return super.delete(this.getKey(key));
    }

    getKey (key) {
        return SnellBeenMap.isA('region', key) ? key.get('id') : key;
    }
}

class SnellGlobe extends am4maps.MapChart
{
    constructor() {
        super();
        this.projection = new am4maps.projections.Orthographic();
        // this.geodata = am4geodata_worldLow;

        this.padding(10, 10, 10, 10);
    
        this.panBehavior = "rotateLongLat";
        this.adapter.add("deltaLatitude", function(delatLatitude){
            return am4core.math.fitToRange(delatLatitude, -90, 90);
        });
    
        this.backgroundSeries.mapPolygons.template.polygon.fill = SnellColors.get('water');
        this.backgroundSeries.mapPolygons.template.polygon.fillOpacity = 0.5;
        this.deltaLongitude = 20;
        this.deltaLatitude = -20;

        //Add Lat/Long lines around Globe:
        var graticuleSeries = this.series.push(new am4maps.GraticuleSeries());
        graticuleSeries.mapLines.template.stroke = am4core.color("#000066");
        graticuleSeries.mapLines.template.strokeOpacity = 1;
        graticuleSeries.fitExtent = false;
    }

    setSnell(snell) {
        this.snell = snell;
        return this;
    }

    reset() {
        this.snell.countries.toFront();
        this.snell.regions.toBack();
        this.zoomControl.buttons.get('countryInfo').hide();
        this.zoomControl.buttons.get('beenInCountrySwitch').hide();
        this.goHome();
    }

    get toolbar() {
        return this.zoomControl;
    }

}

class SnellCountries extends am4maps.MapPolygonSeries {
    constructor (snell, onReady) {
        super();
        this.snell = snell;
        
        if (onReady) {
            this.events.once('ready', onReady)
        }
        this.init();
    }

    showCountry(ev) {
        var country = ev.target;
        var snell = country.series.snell;
        snell.countries.toBack();
        snell.regions.toFront();

        snell.country = country;


        country.isHover = false;
        if (country.get('map')) {
            snell.regions.geodataSource.url = "geodata/json/" + country.get('map') + ".json";
            snell.regions.geodataSource.load();
        }

        snell.globe.toolbar.buttons.get('countryInfo').show();
        var button = snell.globe.toolbar.buttons.get('beenInCountrySwitch');
        button.isActive = snell.been.has(country.get('id'));
        button.show();


        //TODO: find out how to pan the globe lat/long for this country
        // snell.globe.deltaLongitude = snell.globe.centerGeoPoint.longitude - country.longitude;
        // snell.globe.delatLatitude = snell.globe.centerGeoPoint.latitude - country.latitude;
 
        country.series.chart.zoomToMapObject(country);
    }

    init() {
        this.useGeodata = true;
        this.geodata = am4geodata_worldLow;

        var countries = this.mapPolygons.template;
        countries.togglable = false;

        countries.events.on('hit', this.showCountry);

        countries.tooltipText = "{name}";
        countries.nonScalingStroke = true;
        countries.strokeOpacity = 0.5;
        countries.fill = SnellColors.get('country_without_regions');
        countries.propertyFields.fill = "color";

        countries.states.create("hover").properties.fill = SnellColors.get('hover_country');
        countries.states.create("hoverActive").properties.fill = SnellColors.get('hover_country');
        countries.states.create("active").properties.fill = SnellColors.get('been');
        
        // Set up data for countries
        var data = [];
        for(var id in am4geodata_data_countries2) {
            if (am4geodata_data_countries2.hasOwnProperty(id)) {
                var country = am4geodata_data_countries2[id];
                if (country.maps.length) {
                    data.push({
                        id: id,
                        continent: country.continent_code,
                        color: SnellColors.get(country.continent_code),
                        map: country.maps[0],
                    });
                }
            }
        }
        this.data = data;
    }

}

class SnellRegions extends am4maps.MapPolygonSeries {
    constructor (snell, onReady) {
        super();
        this.snell = snell;
        if (onReady) {
            this.events.once('ready', onReady)
        }
        this.hide();
        this.useGeodata = true;
        var regions = this.mapPolygons.template;
        regions.events.on('toggled', function(ev){
            var region = ev.target;
            region.been(region.isActive)
        });
        regions.tooltipText = "{name}";
        regions.nonScalingStroke = true;
        regions.strokeOpacity = 0.5;
        regions.fill = SnellColors.get('region_not_been');

        this.events.on('dataitemsvalidated', function(ev) {
            if (!this.country) return;
            var activeRegions = this.country.activeRegions();
            if (activeRegions) {
                var ids = activeRegions.keys()
                for (const id of ids) {
                    var region = this.regions.getPolygonById(id);
                    if (region) {
                        region.isActive = true;
                    }
                }
            }
        }.bind(snell));

        regions.states.create("hover").properties.fill = SnellColors.get('hover_country');
        regions.states.create("hoverActive").properties.fill = SnellColors.get('hover_country');
        regions.states.create("active").properties.fill = SnellColors.get('been');

    }

    country(region) {
        return region.series.snell.countries.getPolygonById(SnellRegions.getCountryId(region));
    }

    static getCountryId(regionId) {
        if (typeof regionId == 'object') {
            try {
                regionId = regionId.get('id');
            } catch (e) {
                return;
            }
        }
        return regionId.replace(/\-.+/, '');
    }
    
}

class SnellToolbar extends am4maps.ZoomControl {
    constructor(snell) {
        super();

        this.buttons = new Map();
        this.buttons.set('plus', this.plusButton);
        this.buttons.set('min', this.minButton);

        var button = new SnellToolbarButtonCountryInfo(snell);
        button.parent = this;
        button.insertBefore(this.plusButton);
        this.buttons.set(button.id, button);

        var button = new SnellToolbarButtonBeenInCountrySwitch(snell);
        button.parent = this;
        button.insertBefore(this.plusButton);
        this.buttons.set(button.id, button);

        button = new SnellToolbarButtonHome(snell);
        button.parent = this;
        button.insertBefore(this.plusButton);
        this.buttons.set(button.id, button);

        var button = new SnellToolbarButtonStatistics(snell);
        button.parent = this;
        button.insertBefore(this.buttons.get('home'));
        this.buttons.set(button.id, button);

    }

}

class SnellToolbarButton extends am4core.Button {

    constructor(icon, tooltipText, altIcon) {
        super();
        this.defaultIconSource = SnellToolbarButton.iconPath(icon);
        this.altIconSource = altIcon ? SnellToolbarButton.iconPath(altIcon) : null;
        this.isActive = false;
        this.id = "UndefinedButton";
        this.width = 30;
        this.height = 30;
        this.marginBottom = 3;
  
        this.icon = new am4core.Image();
        this.icon.href= this.defaultIconSource;
        this.icon.height = 20;
        this.icon.width = 20;
        this.icon.margin(-10,0,0,-10);
  
        if (tooltipText) {
            this.tooltipText = tooltipText;
        }

        if (altIcon) {
            this.events.on("toggled", this.toggle);
        }
    }

    static iconPath(icon) {
        var path = SnellConfig.getInstance().has('iconPath') ? SnellConfig.getInstance().get('iconPath') : 'icons';
        return `${path}/${icon}.svg`;
    }

    toggle(ev) {
        var button = ev.target;
        var newActiveState = !button.isActive;
        button.icon.href = newActiveState ? button.defaultIconSource : button.altIconSource;
        return button;
    }

}

class SnellToolbarButtonHome extends SnellToolbarButton 
{
    /**
     * 
     * @param {Snell} snell 
     */
    constructor(snell) {
        super('globe', 'Show globe');
        this.id = 'home';

        this.events.on("hit", function() {
            snell.globe.reset();
        }.bind(snell));
    }
}

class SnellToolbarButtonBeenInCountrySwitch extends SnellToolbarButton 
{
    constructor(snell) {
        super('toggle-off', 'Toggle visit to this country.', 'toggle-on')
        this.id = 'beenInCountrySwitch';
        this.hide();
        this.events.on("hit", function(ev) {
            if (snell.country) {
                snell.country.been(ev.target.isActive);
            }
        });
    }
}

class SnellToolbarButtonCountryInfo extends SnellToolbarButton
{
    /**
     * 
     * @param {am4maps.MapPolygon} country 
     */
    constructor(snell) {
        super('info-circle', 'Show more information');
        this.id = 'countryInfo';
        this.hide();

        this.events.on("hit", function(ev) {
            var button = ev.target;
            if (snell.country) {
                am4core.net.load(SnellToolbarButton.iconPath('hourglass-split')).then(function(){
                    button.icon.href= SnellToolbarButton.iconPath('hourglass-split');
                    var id = snell.country.get('id');
                    am4core.net.load('https://restcountries.eu/rest/v2/alpha/' + id).then(function(response) {
                        var country = new am4core.JSONParser().parse(response.response);
                        button.icon.href= button.defaultIconSource;
                        new SnellModalCountryInfo(country).open();
                    });
                });
            }
        }.bind(snell));

    }
}

class SnellToolbarButtonStatistics extends SnellToolbarButton {
    constructor(snell) {
        super('clipboard-check', 'Show travel statistics');
        this.id = 'statistics';

        this.events.on("hit", function(ev) {
            var button = ev.target;
            am4core.net.load(SnellToolbarButton.iconPath('hourglass-split')).then(function(){
                button.icon.href= SnellToolbarButton.iconPath('hourglass-split');
                am4core.net.load(SnellConfig.getInstance().get('api') + '/been/statistics').then(function(response) {
                    var stats = new am4core.JSONParser().parse(response.response);
                    button.icon.href= button.defaultIconSource;
                    new SnellModalStatistics(stats, snell).open();
                });
            });
        });
    }
}

class SnellModal
{
    constructor() {
        this._title = '';
        this._content = '';
    }

    content(html) {
        if (typeof html == 'undefined') return this._content;
        html = html.trim();
        this._content = html;
        if (document.getElementById('SnellModal')) {
            document.getElementById('SnellModal').querySelectorAll('.modal-body').item(0).innerHTML = html;
        }
        return this;
    }

    text(html) {
        return this.content(html);
    }

    title(html) {
        if (typeof html == 'undefined') return this._title;
        html = html.trim();
        this._title = html;
        if (document.getElementById('SnellModal')) {
            document.getElementById('SnellModal').querySelectorAll('.modal-title').item(0).innerHTML = html;
        }
        return this;
    }

    get() {
        if (document.getElementById('SnellModal')) {
            return bootstrap.Modal.getInstance(document.getElementById('SnellModal'));
        }
        var html = `
<div class="modal fade" id="SnellModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1">
    <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">${this.title()}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                ${this.content()}
            </div>
            <!--
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Close</button>
            </div>
            -->
        </div>
    </div>
</div>
        `
        var template = document.createElement('div');
        template.innerHTML = html.trim();
        document.body.appendChild(template);
        
        return new bootstrap.Modal(template.firstElementChild);

    }

    open() {
        var modal = this.get();
        modal.show();
    }
}

class SnellModalCountryInfo extends SnellModal
{
    constructor (country) {
        super();
        var formatter = new am4core.NumberFormatter();
        var region = country.region + (country.subregion ? (' &raquo; ' + country.subregion): '');
        try {
            var dd_class="col-8";
            var dt_class="col-4";
            var html = `
<div class="container-fluid" id="countryInfo">
    <div class="row">
        <div class="col-md-9">
            <dl class="row">
                <dt class="${dt_class}">name</dt>
                <dd class="${dd_class}">
                    <a href="https://en.wikipedia.org/wiki/ISO_3166-1:${country.alpha2Code}"><img src="icons/20px-Wikipedia-logo.png"/></a> 
                    ${country.nativeName}
                </dd>
                <dt class="${dt_class}">capital</dt>
                <dd class="${dd_class}">${country.capital}</dd>
                <dt class="${dt_class}">population</dt>
                <dd class="${dd_class}">${formatter.format(country.population, '#,###')}</dd>
                <dt class="${dt_class}">region</dt>
                <dd class="${dd_class}">${region}</dd>
                <dt class="${dt_class}">area</dt>
                <dd class="${dd_class}">${formatter.format(country.area, '#,###')} m<sup>2</sup></dd>
                <dt class="${dt_class}">currencies</dt>
                <dd class="${dd_class}">${this.currencies(country.currencies)}</dd>
                <dt class="${dt_class}">languages</dt>
                <dd class="${dd_class}">${this.languages(country.languages)}</dd>
                <dt class="${dt_class}">regionalBlocs</dt>
                <dd class="${dd_class}">${this.regionalBlocs(country.regionalBlocs)}</dd>
            </dl>
        </div>
        <div class="col-md-3">
            <p><img class="flag" src="${country.flag}" alt="Flag of ${country.nativeName}"></p>
        </div>
    </div>
</div>
                    `;
                var title = `${country.name} <em style="padding-right: 10px;">(${country.nativeName})</em>)`;

        } catch (err) {
            var html = `An error has occured while parsing countryinfo from <a href="https://restcountries.eu/rest/v2/alpha/${country.alpha2Code}">https://restcountries.eu/rest/v2/alpha/${country.alpha2Code}</a>.`;
            var title = `Error for country ${country.alpha2Code}`;
        }

        this.content(html).title(title);
    }

    currencies(currencies) {
        var c = [];
        var p = currencies.length > 1 ? '• ' : '';
        for (var i = 0; i<currencies.length; i++) {
            c.push(p + currencies[i].symbol + ' ' + currencies[i].name + ' (<em>' + currencies[i].code + '</em>)')
        }
        return c.join('<br>');
    }

    languages(languages) {
        var l = [];
        var p = languages.length > 1 ? '• ' : '';
        for (var i = 0; i < languages.length; i++) {
            l.push(p + languages[i].nativeName + ' ' + ' (<em>' + languages[i].name + '</em>)')
        }
        return l.join('<br>');
    }

    translations(translations) {
        var t = [];
        for (i in translations) {
            t.push('<span style="white-space: nowrap;">' + translations[i]+ ' (<em>'+i+'</em>)</span>');
        }
        return t.join('  ');
    }

    regionalBlocs(regionalBlocs) {
        var rb = [];
        var p = regionalBlocs.length > 1 ? '• ' : '';
        for (var i = 0; i<regionalBlocs.length; i++) {
            rb.push(p + regionalBlocs[i].name + ' ' + ' (<em>' + regionalBlocs[i].acronym + '</em>)')
        }
        if (rb.length) return rb.join('<br>');
        else return '-';
    }
}

class SnellModalStatistics extends SnellModal
{
    constructor (stats, snell) {
        super();
        var formatter = new am4core.NumberFormatter();
        var title = 'All about your Snell journey';

        var accordian = '<div class="accordion accordion-flush" id="beenAnalytics">';
        for (const continent_id in stats) {
          var continent = stats[continent_id];
          var countryList = '<ul class="list-group">';
          for (const country_id in continent.countries) {
            var country = continent.countries[country_id];
            if (snell.countries.byId(country_id) && snell.countries.byId(country_id).get('map')) {
              var toggle_regions = '<span class="toggle-regions"></span>';
            } else {
              var toggle_regions = '';
            }

            var activeClass = country.been ? "active" : "";
            countryList += `
            <a 
              class="list-group-item-country list-group-item list-group-item-action ${activeClass}" 
              id="${country_id}" 
              data-continent="${continent_id}" 
              data-country="${country_id}"
              href="#regions-${country_id}" 
            >
              <span class="country-name">${country.name}</span>
              ${toggle_regions}
              </a>
            <div class="collapse regions" id="regions-${country_id}"></div>
            `;
   
          }
          countryList += '</ul>';
          accordian += `
          <div class="accordion-item" id="accordion-item-${continent_id}">
           <h2 class="accordion-header" id="continent-name-${continent_id}">
             <button class="clearfix accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#continent-countrylist-${continent_id}" aria-expanded="false" aria-controls="continent-countrylist-${continent_id}">
              <div class="container">
                <div class="float-start continent-name">${continent.name}</div>
                <div class="float-end">
                    <span class="badge bg-${continent_id} bg-primary"><span class="continent-been">${continent.num_been}</span>/${continent.num_countries}</span>
                </div>
              </div>
             </button>
             <div class="progress">
              <div class="bg-${continent_id} progress-bar" id="progress-bar-${continent_id}" role="progressbar" style="width: ${continent.pct_been}%;" aria-valuenow="${continent.pct_been}" aria-valuemin="0" aria-valuemax="${continent.num_countries}">${continent.pct_been}%</div>
            </div>
            </h2>
           <div id="continent-countrylist-${continent_id}" class="accordion-collapse collapse" aria-labelledby="continent-name-${continent_id}" data-bs-parent="#beenAnalytics">
            <div class="accordion-body">${countryList}</div>
           </div>
         </div>
           `;
        }
        accordian += '</div>';
   
        var modal = this.content(accordian).title(title).get();
        // open container with Regions:
        document.querySelectorAll('.list-group-item-country .toggle-regions').forEach(function(node){
            node.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();

                var dataset = event.target.closest('.list-group-item-country').dataset;
                var country = snell.countries.byId(dataset.country)
                if (!country) return false;
                var map = country.get('map');
                var collapsable = document.getElementById('regions-' + dataset.country);
                if (!collapsable) return false;
                if (collapsable.innerHTML != '') {
                    event.target.classList.toggle('opened');
                    collapsable.classList.toggle('show');
                } else if (map && !this.classList.contains('show')) {
                    this.classList.toggle('loading');
                    am4core.net.load( "geodata/json/" + map + ".json").then(function(response) {
                        var mapData = new am4core.JSONParser().parse(response.response);
                        var regionsList = '<ul class="list-group list-group-regions">';
                        for (var i in mapData.features) {
                            var region = mapData.features[i].properties;
                            var activeClass = snell.been.hasRegion(region.id) ? "active" : "";
                            regionsList += `<a href="#" class="list-group-item list-group-item-action ${activeClass}" data-region="${region.id}">${region.name}</li>`;
                        }
                        regionsList += '</ul>';
                        collapsable.innerHTML = regionsList;
                        event.target.classList.toggle('opened');
                        collapsable.classList.toggle('show');
                        this.classList.toggle('loading');

                        document.querySelectorAll(`#regions-${dataset.country} .list-group-item-action`).forEach(function(node){
                            node.addEventListener('click', function(event) {
                                event.preventDefault();
                                event.stopPropagation();
                                // snell.countries.byId(this.dataset.country).beenToggle(self.updateProgressBar);
                                var regionId = this.dataset.region;
                                if (true == snell.been.hasRegion(regionId)) {
                                    snell.been.deleteRegion(regionId);
                                } else {
                                    snell.been.setRegion(regionId);
                                    var countryId = SnellRegions.getCountryId(this.dataset.region);
                                    var country = snell.countries.byId(countryId);
                                    if (!country.isActive) {
                                        document.getElementById(countryId).click();
                                    }
                                }
                                this.classList.toggle('active');
                                return false;
                            });
                        });
                    }.bind(this));
                }
                return false;
            });
        });

        var self = this;
        document.querySelectorAll('.list-group-item-country').forEach(function(node){
            node.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                snell.countries.byId(this.dataset.country).beenToggle(self.toggleCountry);
                return false;
            });
        });



    }

    toggleCountry(country) {
        var continent = country.get('continent');
        document.getElementById(country.get('id')).classList[country.isActive ? 'add' : 'remove']('active');
        var continent_been = document.querySelectorAll(`.bg-${continent} .continent-been`).item(0);
        var new_num_been = parseInt(continent_been.textContent) + (country.isActive ? 1 : -1);
        continent_been.textContent = new_num_been;

        //new progressbar values:
        var progressbar = document.getElementById(`progress-bar-${continent}`);
        var num_countries = parseInt(progressbar.getAttribute('aria-valuemax'));
        var new_pct_been = Math.round(100 * (new_num_been / num_countries));
        progressbar.style.width = `${new_pct_been}%`;
        progressbar.setAttribute('aria-valuenow', new_pct_been);
        progressbar.textContent = progressbar.style.width;

        if (!country.isActive) {
            document.querySelectorAll(`#regions-${country.get('id')} .list-group-item-action`).forEach(function(node){
                node.classList.remove('active');
            });
        }
    }
}

class SnellColors {
    static get(key) {
        return {
            "AF": am4core.color({r: 244, g: 67, b: 54}),
            "AN": am4core.color({r: 33, g: 150, b: 243}),
            "AS": am4core.color({r: 156, g: 39, b: 176}),
            "EU": am4core.color({r: 103, g: 58, b: 183}),
            "NA": am4core.color({r: 63, g: 81, b: 181}),
            "OC": am4core.color({r: 33, g: 150, b: 243}),
            "SA": am4core.color({r: 0, g: 188, b: 212}),
            "AQ": am4core.color({r: 220, g: 103, b: 171}),
            "been":                     am4core.color('#ffbf80'), 
            "region_not_been":          am4core.color('#ffe6cc'),
            'water':                    am4core.color('#024baaa2'),
            'hover_country':            am4core.color('#50AF4C'),
            'country_without_regions':  am4core.color('#b3b3cc')
        }[key];
    }

}



am4maps.MapPolygon.prototype.get = function(key) {
    // if (key == 'continent' && this.get('id').match(/$([a-zA-Z]]{2})\-([a-zA-Z0-9]+)^/)) {
    //     return SnellBeenMapRegions.getCountryId(this.get('id'));
    // }
    return this.dataItem.dataContext[key];
}

am4maps.MapPolygon.prototype.been = function (beenOrNot, callback) {
    if (typeof beenOrNot != 'boolean') {
        throw 'am4maps.MapPolygon.prototype.been expects Boolean argument';
    }
    var method = (beenOrNot ? 'set' : 'delete') + (this.series instanceof SnellRegions ? 'Region' : 'Country');
    this.series.snell.been[method](this);
    this.isActive = beenOrNot;

    if (this.series instanceof SnellRegions && true == beenOrNot) {
        var countryId = SnellRegions.getCountryId(this)
        this.series.snell.countries.getPolygonById(countryId).isActive = true;
    }

    if (callback) {
        callback(this);
    }
    return this;
}

am4maps.MapPolygon.prototype.beenToggle = function (callback) {
    return this.been(!this.isActive, callback);
}

am4maps.MapPolygon.prototype.activeRegions = function() {
    if (this.series instanceof SnellCountries) {
        return this.series.snell.been.get(this);
    }
}

am4maps.MapPolygonSeries.prototype.byId = function (id) {
    return this.getPolygonById(id);
}
export {Snell};
