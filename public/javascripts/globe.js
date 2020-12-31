const getVal = country => countries[country.id] ? continent_codes.indexOf(countries[country.id].continent_code) : 7;

var countries = new Map();

const continents = {
    AN: 'Antartica',
    AS: 'Asia',
    EU: 'Europe',
    NA: 'North America',
    OC: 'Oceania',
    SA: 'South America'
}
const continent_codes = Object.keys(continents);
const colorScale = d3.scaleSequentialSqrt(d3.interpolateYlOrRd);
colorScale.domain([0, continent_codes.length + 1]);

const getCountryCentre = (countryId, next)  => {
    if (!next) next = undefined => {};
    if (!countries[countryId] || !countries[countryId].feature) return next({}, new Error(`Country ${countryId} not found or has no feature`));

    let polygons = countries[countryId].feature.geometry.coordinates;
    var polygon = polygons[0];
    if (typeof polygon[0][0] != 'number') polygon = polygon[0];
    var con = new Contour(polygon);
    center = con.centroid();
    return next(center)


    /*

    var map = countries[countryId].maps && countries[countryId].maps.length ? countries[countryId].maps[0]: false;
    if (!map) return next({}, new Error(`Country ${countryId} not found`));

    fetch(`geodata/json/${map}.json`).then(res => res.json()).then(country => {
        next(country);
    });
    */


}


function Point(x,y) {
    this.x=x;
    this.y=y;
 }
 
 // Contour object
 function Contour(points) {
     this.pts = points || []; // an array of Point objects defining the contour
 }
 
 
 Contour.prototype.area = function() {
    var area=0;
    var pts = this.pts;
    var nPts = pts.length;
    var j=nPts-1;
    var p1; var p2;
 
    for (var i=0;i<nPts;j=i++) {
       p1=pts[i]; p2=pts[j];
       area+=p1[0]*p2[1];
       area-=p1[1]*p2[0];
    }
    area/=2;
     
    return area;
 };
 
 Contour.prototype.centroid = function() {
    var pts = this. pts;
    var nPts = pts.length;
    var x=0; var y=0;
    var f;
    var j=nPts-1;
    var p1; var p2;
 
    for (var i=0;i<nPts;j=i++) {
       p1=pts[i]; p2=pts[j];
       f=p1[0]*p2[1]-p2[0]*p1[1];
       x+=(p1[0]+p2[0])*f;
       y+=(p1[1]+p2[1])*f;
    }
 
    f=this.area()*6;
     
    return new Point(x/f, y/f);
 };
 