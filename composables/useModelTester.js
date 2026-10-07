// composables/useModelTester.js
// ─────────────────────────────────────────────────────────────────────────────
// CHẾ ĐỘ THỬ MÔ HÌNH 3D (chỉ dành cho người thử nghiệm)
//
// • Chỉ email trong MODEL_TESTERS mới thấy nút "Thử mô hình 3D" trên bản đồ.
// • File .glb được chọn TỪ MÁY người thử (chọn được nhiều file cùng lúc) và
//   đọc ngay trong trình duyệt — không tải lên đâu cả, không nằm trên GitHub.
// • File phải là bản đã chuẩn bị cho bản đồ: toạ độ tính bằng mét, tâm tại
//   toà nhà (x = Đông, y = lên, z = −Bắc) và có asset.extras:
//     – extras.georef = { o, e, n } (kinh-vĩ độ của tâm, điểm 100 m về Đông,
//       100 m về Bắc) + extras.building = 'B1'…   (các file B1–B6), hoặc
//     – extras.origin_vn2000 khớp một mục trong MODEL_GEO (file LH).
//   File gốc chưa chuẩn bị sẽ bị từ chối.
// • Khi đang xem bên trong một toà (chọn tầng/phòng), mô hình của toà đó tự ẩn.
// ─────────────────────────────────────────────────────────────────────────────
import maplibregl from 'maplibre-gl'

// Email được phép thấy chế độ thử (viết thường)
export const MODEL_TESTERS = ['nghia.lt@vgu.edu.vn', 'thy.ph@vgu.edu.vn']

// Toạ độ đặt mô hình cho file chỉ có origin_vn2000 (VN-2000 TM-3 105°45').
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

function resolveGeo(extras) {
  if (extras?.georef?.o && extras.georef.e && extras.georef.n) {
    return { id: String(extras.building || 'MODEL'), geo: extras.georef }
  }
  const origin = extras?.origin_vn2000
  const id = origin && Object.keys(MODEL_GEO).find(k =>
    Math.abs(MODEL_GEO[k].E0 - origin.E) < 1 && Math.abs(MODEL_GEO[k].N0 - origin.N) < 1)
  return id ? { id, geo: MODEL_GEO[id] } : null
}

export function createModelTester(getMap, baseURL) {
  let THREE = null
  const models = new Map() // id -> { scene, matrix, geo }
  let excluded = null      // toà đang được xem bên trong → ẩn mô hình
  let visible = false
  let layerMap = null

  function applyBuildingHeights(map) {
    if (!map.getLayer('vgu-buildings-3d')) return
    const ids = visible ? [...models.keys()].filter(id => id !== excluded) : []
    map.setPaintProperty('vgu-buildings-3d', 'fill-extrusion-height', ids.length
      ? ['match', ['get', 'building_id'], ids, 0, ['get', 'height']]
      : ['get', 'height'])
  }

  function makeLayer() {
    return {
      id: LAYER_ID,
      type: 'custom',
      renderingMode: '3d',
      onAdd(map, gl) {
        this.camera = new THREE.Camera()
        this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true })
        this.renderer.autoClear = false
      },
      render(gl, projMatrix) {
        const P = new THREE.Matrix4().fromArray(projMatrix)
        this.renderer.resetState()
        for (const [id, m] of models) {
          if (id === excluded) continue
          this.camera.projectionMatrix = P.clone().multiply(m.matrix)
          this.renderer.render(m.scene, this.camera)
        }
      },
      onRemove() { this.renderer = null },
    }
  }

  function buildMatrix(geo) {
    const m0 = maplibregl.MercatorCoordinate.fromLngLat(geo.o, 0)
    const me = maplibregl.MercatorCoordinate.fromLngLat(geo.e, 0)
    const mn = maplibregl.MercatorCoordinate.fromLngLat(geo.n, 0)
    const s = m0.meterInMercatorCoordinateUnits()
    const ex = [(me.x - m0.x) / 100, (me.y - m0.y) / 100]
    const ey = [(mn.x - m0.x) / 100, (mn.y - m0.y) / 100]
    // mô hình: x = Đông, y = lên, z = −Bắc (mét)
    return new THREE.Matrix4().set(
      ex[0], 0, -ey[0], m0.x,
      ex[1], 0, -ey[1], m0.y,
      0, s, 0, 0,
      0, 0, 0, 1)
  }

  function disposeScene(scene) {
    scene?.traverse(o => {
      if (o.isMesh) { o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()) }
    })
  }

  // Đọc 1 file .glb từ máy → trả về mã toà nhà (vd 'LH', 'B1')
  async function loadFile(file) {
    THREE = THREE || await import('three')
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

    const r = resolveGeo(gltf.asset?.extras)
    if (!r) throw new Error('not-prepared')

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const sun = new THREE.DirectionalLight(0xffffff, 1.6)
    sun.position.set(60, 120, 40)
    scene.add(sun)
    gltf.scene.traverse(o => {
      if (!o.isMesh) return
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        m.side = THREE.DoubleSide
        // Kính (transmission) cần render pass riêng → đổi thành trong suốt thường
        if (m.transmission > 0) { m.transmission = 0; m.transparent = true; m.opacity = 0.35; m.depthWrite = false }
      }
    })
    scene.add(gltf.scene)

    if (models.has(r.id)) disposeScene(models.get(r.id).scene)
    models.set(r.id, { scene, matrix: buildMatrix(r.geo), geo: r.geo })
    return r.id
  }

  function show({ fly = false } = {}) {
    const map = getMap()
    if (!map || !models.size) return
    visible = true
    if (layerMap !== map || !map.getLayer(LAYER_ID)) { map.addLayer(makeLayer()); layerMap = map }
    applyBuildingHeights(map)
    if (fly) {
      const pts = [...models.values()].map(m => m.geo.o)
      const center = [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
      map.flyTo({ center, zoom: pts.length > 1 ? 17.6 : 18.6, pitch: 60, bearing: -30, duration: 1500 })
    }
    map.triggerRepaint()
  }

  function hide() {
    const map = getMap()
    visible = false
    if (!map) return
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID)
    applyBuildingHeights(map)
    layerMap = null
  }

  // Gọi khi người dùng vào/ra một toà (null = đang xem toàn campus)
  function setExcluded(buildingId) {
    excluded = buildingId || null
    const map = getMap()
    if (map && visible) { applyBuildingHeights(map); map.triggerRepaint() }
  }

  function loadedIds() { return [...models.keys()] }

  function destroy() {
    try { hide() } catch (_) {}
    for (const m of models.values()) disposeScene(m.scene)
    models.clear()
  }

  return { loadFile, show, hide, setExcluded, loadedIds, destroy }
}
