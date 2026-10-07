// composables/useModelTester.js
// ─────────────────────────────────────────────────────────────────────────────
// CHẾ ĐỘ THỬ MÔ HÌNH 3D (chỉ dành cho người thử nghiệm)
//
// • Chỉ email trong MODEL_TESTERS mới thấy nút "Thử mô hình 3D" trên bản đồ.
// • File .glb được chọn TỪ MÁY người thử và đọc ngay trong trình duyệt —
//   không tải lên đâu cả, không nằm trên GitHub → người khác không thể xem.
// • File phải là bản đã chuẩn bị cho bản đồ (đã đưa về tâm toà nhà, có
//   asset.extras.origin_vn2000). Bản gốc xuất từ IFC sẽ bị từ chối.
// • Mở cho mọi người sau này: bỏ điều kiện email + đặt file vào public/.
// ─────────────────────────────────────────────────────────────────────────────
import maplibregl from 'maplibre-gl'

// Email được phép thấy chế độ thử (viết thường)
export const MODEL_TESTERS = ['nghia.lt@vgu.edu.vn']

// Toạ độ đặt mô hình. E0/N0: tâm mô hình theo VN-2000 TM-3 kinh tuyến 105°45'
// (Bình Dương). o/e/n: kinh-vĩ độ WGS84 của tâm, của điểm cách tâm 100 m về
// phía Đông và 100 m về phía Bắc (tính sẵn bằng pyproj, gồm cả độ lệch lưới).
const MODEL_GEO = {
  LH: {
    E0: 594301.09, N0: 1228433.75,
    o: [106.61502684609346, 11.107046143806222],
    e: [106.61594218272776, 11.107043512780015],
    n: [106.61502950876205, 11.107950164052754],
  },
}

const LAYER_ID = 'vgu-model-test'

export function canTestModels(email) {
  return !!email && MODEL_TESTERS.includes(String(email).trim().toLowerCase())
}

export function createModelTester(getMap, baseURL) {
  let THREE = null
  let root = null      // THREE.Group chứa mô hình
  let matrix = null    // ma trận mô hình (mét cục bộ → toạ độ Mercator)
  let buildingId = null
  let layerMap = null  // map instance đang giữ layer

  function setBuildingHidden(map, hidden) {
    if (!map.getLayer('vgu-buildings-3d')) return
    map.setPaintProperty('vgu-buildings-3d', 'fill-extrusion-height', hidden
      ? ['case', ['==', ['get', 'building_id'], buildingId], 0, ['get', 'height']]
      : ['get', 'height'])
  }

  function makeLayer() {
    return {
      id: LAYER_ID,
      type: 'custom',
      renderingMode: '3d',
      onAdd(map, gl) {
        this.camera = new THREE.Camera()
        this.scene = new THREE.Scene()
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.2))
        const sun = new THREE.DirectionalLight(0xffffff, 1.6)
        sun.position.set(60, 120, 40)
        this.scene.add(sun)
        this.scene.add(root)
        this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })
        this.renderer.autoClear = false
      },
      render(gl, projMatrix) {
        this.camera.projectionMatrix = new THREE.Matrix4().fromArray(projMatrix).multiply(matrix)
        this.renderer.resetState()
        this.renderer.render(this.scene, this.camera)
      },
      onRemove() {
        this.scene?.remove(root)
        this.renderer = null
      },
    }
  }

  function disposeModel() {
    root?.traverse(o => {
      if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()) }
    })
    root = null
  }

  // Đọc file .glb từ máy người dùng → trả về mã toà nhà (vd 'LH')
  async function loadFile(file) {
    THREE = await import('three')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js')

    const buf = await file.arrayBuffer()
    const draco = new DRACOLoader().setDecoderPath(`${baseURL}draco/`)
    let gltf
    try {
      gltf = await new Promise((resolve, reject) =>
        new GLTFLoader().setDRACOLoader(draco).parse(buf, '', resolve, reject))
    } finally {
      draco.dispose()
    }

    const origin = gltf.asset?.extras?.origin_vn2000
    const id = origin && Object.keys(MODEL_GEO).find(k =>
      Math.abs(MODEL_GEO[k].E0 - origin.E) < 1 && Math.abs(MODEL_GEO[k].N0 - origin.N) < 1)
    if (!id) throw new Error('not-prepared')

    hide()
    disposeModel()
    root = gltf.scene
    root.traverse(o => { if (o.isMesh) o.material.side = THREE.DoubleSide })
    buildingId = id

    // Mô hình: x = Đông, y = lên, z = −Bắc (mét, tâm = E0/N0, đáy = 0)
    const g = MODEL_GEO[id]
    const m0 = maplibregl.MercatorCoordinate.fromLngLat(g.o, 0)
    const me = maplibregl.MercatorCoordinate.fromLngLat(g.e, 0)
    const mn = maplibregl.MercatorCoordinate.fromLngLat(g.n, 0)
    const s = m0.meterInMercatorCoordinateUnits()
    const ex = [(me.x - m0.x) / 100, (me.y - m0.y) / 100]
    const ey = [(mn.x - m0.x) / 100, (mn.y - m0.y) / 100]
    matrix = new THREE.Matrix4().set(
      ex[0], 0, -ey[0], m0.x,
      ex[1], 0, -ey[1], m0.y,
      0, s, 0, 0,
      0, 0, 0, 1)
    return id
  }

  function show({ fly = false } = {}) {
    const map = getMap()
    if (!map || !root) return
    if (layerMap !== map || !map.getLayer(LAYER_ID)) {
      map.addLayer(makeLayer())
      layerMap = map
    }
    setBuildingHidden(map, true)
    if (fly) map.flyTo({ center: MODEL_GEO[buildingId].o, zoom: 18.6, pitch: 60, bearing: -30, duration: 1500 })
    map.triggerRepaint()
  }

  function hide() {
    const map = getMap()
    if (!map) return
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
    if (buildingId) setBuildingHidden(map, false)
    layerMap = null
  }

  function destroy() {
    try { hide() } catch (_) {}
    disposeModel()
  }

  return { loadFile, show, hide, destroy }
}
