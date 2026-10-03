<!-- pages/buildings.vue
     Trang này đã được tích hợp vào bản đồ chính dưới dạng
     BuildingsDashboardPanel (components/BuildingsDashboardPanel.vue).
     Redirect về "/" để các link cũ không bị 404. -->
<template><div></div></template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
onMounted(() => {
  router.replace({ path: '/' })
})
</script>
