import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)
export default new Router({
    routes: [
        {
            path: '/old',
            name: 'OldIndex',
            component: () => import('./components/old/Index')
        },
        {
            path: '/new',
            name: 'NewIndex',
            component: () => import('./components/drawboard/Index')
        }
    ]
})
