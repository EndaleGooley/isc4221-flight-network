# Data attribution

This site contains an adapted database derived from the [OpenFlights airport and route databases](https://openflights.org/data). The route snapshot dates to June 2014. The database is made available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/); individual contents are covered by the [Database Contents License (DbCL) 1.0](https://opendatacommons.org/licenses/dbcl/1-0/). The adapted `data/network.json` database is made available under ODbL 1.0.

Transformations: select country “United States” and valid IATA codes, retain domestic zero-stop endpoint pairs, remove self-loops, merge airlines and directions into unique undirected edges, and derive degrees, rankings, components, and shortest-flight layers. No current schedules are implied.

State boundaries: [PublicaMundi MappingAPI GeoJSON example](https://github.com/PublicaMundi/MappingAPI/blob/master/data/geojson/us-states.json), based on U.S. Census state boundaries. Unused density metadata is retained in the original source file.
