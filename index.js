import L from 'leaflet'
import 'leaflet.markercluster/dist/leaflet.markercluster'
import loadYmapsScript from './ymaps-script-load'
import extendYmapsLeaflet from './ymaps-extend-leaflet'

class LeafletService {
  constructor() {
    this.isInited = false
    // instance leaflet карты
    this.leafletMap = null
    // маркер для адреса найденного через поиск
    this.myAddressMarker = null
    // маркер для выбранной точки
    this.currentMarker = null
    // layer, содержащий все маркеры (нужен для очистки и добавления новых маркеров)
    this.currentMarkersLayer = null

    // Иконки для каждого типа маркеров
    this.iconDefaultMarker = null
    this.iconCurrentMarker = null
    this.iconMyAddressMarker = null

    this.config = {
      domElementId:       'map', // id дом элемена в который вставлять карту
      zoomDefault:        13,
      zoomMax:            18,
      iconDefaultClass:   's-pickup-map__marker s-pickup-map__marker_point',
      iconCurrentClass:   's-pickup-map__marker s-pickup-map__marker_selected',
      iconMyAddressClass: 's-pickup-map__marker s-pickup-map__marker-my',
      onSelectPoint:      null, // Колбэк при выборе точки
    }
  }

  configure(config) {
    this.config = { ...this.config, ...config }

    return this
  }

  async init() {
    const {
      zoomDefault, zoomMax, domElementId, iconDefaultClass, iconCurrentClass, iconMyAddressClass
    } = this.config

    extendYmapsLeaflet(L) // Расширяем leaflet для работы с яндекс картами
    await loadYmapsScript()

    this.leafletMap = new L.Map(domElementId, {
      zoom:          zoomDefault,
      maxZoom:       zoomMax,
      zoomAnimation: false
    })
    this.iconDefaultMarker = L.divIcon({ className: iconDefaultClass })
    this.iconCurrentMarker = L.divIcon({ className: iconCurrentClass })
    this.iconMyAddressMarker = L.divIcon({ className: iconMyAddressClass })

    const yandexLayer = new L.Yandex()
    // Убираем возможность взаимодействия с элементами яндекс карты
    yandexLayer.on('MapObjectInitialized', (e) => e.mapObject.options.set('yandexMapDisablePoiInteractivity', true))

    this.leafletMap.addLayer(yandexLayer)
    this.isInited = true
  }

  // Добавление точек на карту
  loadPoints(points, currentPoint = null) {
    if (!this.isInited) {
      throw new Error('loadPoints error: сначала запустите метод "init"')
    }

    this.removePoints()

    // Скрываем подсвечивание области где находятся маркеры в кластере
    this.currentMarkersLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
    })

    // Добавляем маркеры по кластерам
    const geoJsonLayer = L.geoJson({
      type:     'FeatureCollection',
      features: points,
    }, {
      // заменяем маркеры на свои
      pointToLayer: (point, coords) => {
        const isCurrent = currentPoint && currentPoint.id === point.id
        const icon = isCurrent ? this.iconCurrentMarker : this.iconDefaultMarker
        const marker = L.marker(coords, { icon })

        if (isCurrent) {
          this.currentMarker = marker
        }

        return marker
      },
    })

    this.currentMarkersLayer.addLayer(geoJsonLayer)
    this.currentMarkersLayer.on('click', this.$onClickMarker)
    this.leafletMap.addLayer(this.currentMarkersLayer)
    this.leafletMap.fitBounds(this.currentMarkersLayer.getBounds())

    // Если есть выбранная точка то центрируем карту по ней
    if (currentPoint !== null) {
      this.setMapCenter(currentPoint.geometry.coordinates, this.config.zoomDefault)
      // Иначе центрируем карту в зависимости от города
    } else {
      const firstPointCoords = points[0].geometry.coordinates

      this.setMapCenter(firstPointCoords)
    }

    return this
  }

  // Удаление всех точек
  removePoints() {
    if (this.currentMarkersLayer !== null) {
      this.leafletMap.removeLayer(this.currentMarkersLayer)
      this.currentMarkersLayer = null
    }

    return this
  }

  // Центрирование карты по массиву координат
  setMapCenter(coords, zoom = null) {
    if (zoom === null) {
      const currentZoom = this.leafletMap.getZoom()
      zoom = currentZoom < this.config.zoomDefault ? this.config.zoomDefault : currentZoom
    }

    const [lng, lat] = coords

    this.leafletMap.setView({ lng, lat }, zoom)

    return this
  }

  setCurrentMarker(marker) {
    this.currentMarker = marker
    this.currentMarker.setIcon(this.iconCurrentMarker)

    return this
  }

  resetCurrentMarker() {
    if (this.currentMarker !== null) {
      this.currentMarker.setIcon(this.iconDefaultMarker)
      this.currentMarker = null
    }

    return this
  }

  addMyAddressMarker(coords) {
    this.removeMyAddressMarker()
    this.setMapCenter(coords)
    this.myAddressMarker = L.marker(coords.reverse()).setIcon(this.iconMyAddressMarker)
    this.leafletMap.addLayer(this.myAddressMarker)

    return this
  }

  removeMyAddressMarker() {
    if (this.myAddressMarker) {
      this.leafletMap.removeLayer(this.myAddressMarker)
    }

    return this
  }

  destroy() {
    this.resetCurrentMarker()
    this.removePoints()

    if (this.leafletMap) {
      this.leafletMap.remove()
      this.leafletMap = null
    }
  }

  $onClickMarker = event => {
    this.resetCurrentMarker()
    this.setCurrentMarker(event.layer)

    const [lng, lat] = event.sourceTarget.feature.geometry.coordinates

    this.setMapCenter([lng, lat])

    if (typeof this.config.onSelectPoint === 'function') {
      const point = event.sourceTarget.feature

      this.config.onSelectPoint(point)
    }
  }
}

export default LeafletService
