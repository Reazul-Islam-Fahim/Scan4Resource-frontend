import { useEffect, useRef, useState } from 'react'
import Viewer from './Viewer'

/**
 * The scan's 3D model (scene.glb, a coloured point cloud) to turn around with a finger: drag to rotate, pinch or
 * scroll to zoom, two fingers to move. three.js loads only when the preview opens.
 */
export default function ModelPreview({ src, onClose }) {
  const holderRef = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    ;(async () => {
      try {
        const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/controls/OrbitControls.js'),
        ])
        const gltf = await new GLTFLoader().loadAsync(src)
        if (disposed) return
        const holder = holderRef.current

        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#10302a')
        scene.add(gltf.scene)

        // Fit the camera to the scan and size the points to it.
        const box = new THREE.Box3().setFromObject(gltf.scene)
        const size = box.getSize(new THREE.Vector3())
        const centre = box.getCenter(new THREE.Vector3())
        const radius = Math.max(size.length() / 2, 0.1)
        gltf.scene.traverse((node) => {
          if (node.isPoints) node.material.size = radius / 120
        })

        const camera = new THREE.PerspectiveCamera(60, holder.clientWidth / holder.clientHeight, radius / 100, radius * 20)
        camera.position.copy(centre).add(new THREE.Vector3(0, radius * 0.4, radius * 1.8))

        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.setSize(holder.clientWidth, holder.clientHeight)
        holder.appendChild(renderer.domElement)

        const controls = new OrbitControls(camera, renderer.domElement)
        controls.target.copy(centre)
        controls.enableDamping = true
        controls.update()

        const resize = () => {
          camera.aspect = holder.clientWidth / holder.clientHeight
          camera.updateProjectionMatrix()
          renderer.setSize(holder.clientWidth, holder.clientHeight)
        }
        window.addEventListener('resize', resize)
        renderer.setAnimationLoop(() => {
          controls.update()
          renderer.render(scene, camera)
        })
        setStatus('ready')

        cleanup = () => {
          window.removeEventListener('resize', resize)
          renderer.setAnimationLoop(null)
          controls.dispose()
          gltf.scene.traverse((node) => {
            node.geometry?.dispose()
            node.material?.dispose()
          })
          renderer.dispose()
          renderer.domElement.remove()
        }
      } catch {
        if (!disposed) setStatus('error')
      }
    })()
    return () => {
      disposed = true
      cleanup()
    }
  }, [src])

  return (
    <Viewer title="3D model" onClose={onClose} download={{ label: 'Download 3D model', href: src }}>
      <div ref={holderRef} className="model-stage">
        {status === 'loading' && <p className="viewer-msg model-msg">Loading the 3D model…</p>}
        {status === 'error' && <p className="viewer-msg model-msg">The 3D model could not be shown here. You can still download it.</p>}
      </div>
      {status === 'ready' && <p className="note viewer-hint">Drag to turn, pinch to zoom, two fingers to move.</p>}
    </Viewer>
  )
}
