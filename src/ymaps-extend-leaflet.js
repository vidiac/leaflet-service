export default (L) => {
  L.Yandex = L.Layer.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,

    options: {
      minZoom:     0,
      maxZoom:     18,
      attribution: '',
      opacity:     1,
      traffic:     false,
      zoomSpeed:   250
    },

    state: {
      lastZoom: null
    },

    possibleShortMapTypes: {
      schemaMap:             'map',
      satelliteMap:          'satellite',
      hybridMap:             'hybrid',
      publicMap:             'publicMap',
      publicMapInHybridView: 'publicMapHybrid'
    },

    _getPossibleMapType(mapType) {
      let result = 'yandex#map'
      if (typeof mapType !== 'string') {
        return result
      }
      for (let key in this.possibleShortMapTypes) {
        if (mapType === this.possibleShortMapTypes[key]) {
          result = 'yandex#' + mapType
          break
        }
        if (mapType === ('yandex#' + this.possibleShortMapTypes[key])) {
          result = mapType
        }
      }
      return result
    },

    //  Possible types: yandex#map, yandex#satellite, yandex#hybrid, yandex#publicMap, yandex#publicMapHybrid
    //  Or their short names: map, satellite, hybrid, publicMap, publicMapHybrid
    initialize(type, options) {
      L.Util.setOptions(this, options)
      this._type = this._getPossibleMapType(type)
    },

    onAdd(map, insertAtTheBottom) {
      this._map = map
      this._insertAtTheBottom = insertAtTheBottom

      //  create a container div for tiles
      this._initContainer()
      this._initMapObject()

      //  set up events
      map.on('viewreset', this._reset, this)

      //  this._limitedUpdate = L.Util.throttle(this._update, 150, this)
      map.on('move', this._update, this)

      if (map.options.zoomAnimation) {
        map.on('zoomstart', this._zoomAnim, this)
      }

      map._controlCorners.bottomright.style.marginBottom = '3em'

      this._reset()
      this._update(true)
    },

    onRemove(map) {
      this._map._container.removeChild(this._container)

      this._map.off('viewreset', this._reset, this)

      this._map.off('move', this._update, this)

      if (map.options.zoomAnimation) {
        map.off('zoomstart', this._zoomAnim, this)
      }

      if (map._controlCorners) {
        map._controlCorners.bottomright.style.marginBottom = '0em'
      }
    },

    getAttribution() {
      return this.options.attribution
    },

    setOpacity(opacity) {
      this.options.opacity = opacity
      if (opacity < 1) {
        L.DomUtil.setOpacity(this._container, opacity)
      }
    },

    setElementSize: function (e, size) {
      e.style.width = size.x + 'px'
      e.style.height = size.y + 'px'
    },

    _initContainer() {
      let tilePane = this._map._container,
        first = tilePane.firstChild

      if (!this._container) {
        this._container = L.DomUtil.create('div', 'leaflet-yandex-layer')
        this._container.id = '_YMapContainer_' + L.Util.stamp(this)
        this._container.style.zIndex = 'auto'
      }

      if (this.options.overlay) {
        first = this._map._container.getElementsByClassName('leaflet-map-pane')[0]
        first = first.nextSibling
        //  XXX: Bug with layer order
        if (L.Browser.opera) {
          this._container.className += ' leaflet-objects-pane'
        }
      }
      tilePane.insertBefore(this._container, first)

      this.setOpacity(this.options.opacity)
      this.setElementSize(this._container, this._map.getSize())
    },

    _initMapObject() {
      if (this._yandex) return

      //  Check that ymaps.Map is ready
      if (ymaps.Map === undefined) {
        return ymaps.load(['package.map'], this._initMapObject, this)
      }

      //  If traffic layer is requested check if control.TrafficControl is ready
      if (this.options.traffic) {
        if (ymaps.control === undefined ||
          ymaps.control.TrafficControl === undefined) {
          return ymaps.load(['package.traffic', 'package.controls'],
            this._initMapObject, this)
        }
      }
      // Creating ymaps map-object without any default controls on it
      let map = new ymaps.Map(this._container, { center: [0, 0], zoom: 0, behaviors: [], controls: [] })

      if (this.options.traffic) {
        map.controls.add(new ymaps.control.TrafficControl({ shown: true }))
      }

      if (this._type === 'yandex#null') {
        this._type = new ymaps.MapType('null', [])
        map.container.getElement().style.background = 'transparent'
      }
      map.setType(this._type)

      this._yandex = map
      this._update(true)

      // Reporting that map-object was initialized
      this.fire('MapObjectInitialized', { mapObject: map })
    },

    _reset() {
      this._initContainer()
    },

    _update(force) {
      if (!this._yandex) return
      this._resize(force)

      let center = this._map.getCenter()
      let _center = [center.lat, center.lng]
      let zoom = this._map.getZoom()

      const options = {}

      if (this.state.lastZoom !== zoom) {
        this.state.lastZoom = zoom
        options.duration = this.options.zoomSpeed
      }

      this._yandex.setCenter(_center, zoom, options)
    },

    _resize(force) {
      let size = this._map.getSize(), style = this._container.style
      if (style.width === size.x + 'px' && style.height === size.y + 'px') {
        if (force !== true) return
      }
      this.setElementSize(this._container, size)
      this._yandex.container.fitToViewport()
    },

    _zoomAnim(e) {
      if (!this._yandex) return

      let center = e.target.options.center
      let _center = [center.lat, center.lng]
      let zoom = e.target.options.zoom

      this._yandex.setCenter(_center, zoom, { duration: this.options.zoomSpeed })
    },
  })
}
