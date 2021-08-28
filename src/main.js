import Vue from 'vue'
import App from './App.vue'
import Element from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import router from "./router";

Vue.config.productionTip = false;
Vue.use(Element);
import fabric from 'fabric'

Vue.use(fabric);
new Vue({
    router,
    render: h => h(App),
}).$mount('#app')
