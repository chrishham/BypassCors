import '@babel/polyfill'
import Vue from 'vue'
import './plugins/bootstrap-vue'
import Notify from 'vue-notifyjs'
import App from './App.vue'
import router from './router'

Vue.use(Notify)

Vue.config.productionTip = false

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
