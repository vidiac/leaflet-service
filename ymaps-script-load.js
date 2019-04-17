const state = {
  isLoaded: false,
  promise:  null,
}

const YANDEX_MAPS_API_URL = 'https://api-maps.yandex.ru/2.1/?load=package.map&lang=ru-RU'

/**
 * Подружает динамически скрипт для работы с api яндекс карт
 * @return {Promise<any> | Promise} промис
 */
export default () => {
  if (state.isLoaded) {
    return Promise.resolve()
  }

  if (!state.promise) {
    state.promise = new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = YANDEX_MAPS_API_URL
      script.onload = () => {
        state.isLoaded = true
        state.promise = null
        window.ymaps.ready(resolve)
      }
      document.body.appendChild(script)
    })
  }

  return state.promise
}
