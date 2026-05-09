"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { AsciiEffect } from "three/examples/jsm/effects/AsciiEffect.js";

type AnvilAsciiProps = {
  className?: string;
  modelUrl?: string;
};

export function AnvilAscii(props: AnvilAsciiProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modelUrl = useMemo(() => props.modelUrl ?? "/models/Anvil.obj", [props.modelUrl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerEl = container;

    setStatus("loading");
    setErrorMessage(null);

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
    camera.position.set(0, 18, 80);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(40, 60, 30);
    scene.add(key);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const effect = new AsciiEffect(renderer, " .:-+*=%@#", {
      invert: true,
    });
    effect.domElement.style.color = "#54f0b4";
    effect.domElement.style.backgroundColor = "transparent";
    effect.domElement.style.width = "100%";
    effect.domElement.style.height = "100%";
    effect.domElement.style.display = "block";

    containerEl.innerHTML = "";
    containerEl.appendChild(effect.domElement);

    let disposed = false;
    let frame = 0;
    let model: THREE.Object3D | null = null;

    function resize() {
      const rect = containerEl.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      effect.setSize(width, height);
    }

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(containerEl);
    resize();

    const loader = new OBJLoader();
    loader.load(
      modelUrl,
      (obj) => {
        if (disposed) return;

        model = obj;

        const box = new THREE.Box3().setFromObject(obj);
        const center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center);

        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 38 / maxDim;
        obj.scale.setScalar(scale);
        obj.rotation.set(0, Math.PI * 0.22, 0);

        scene.add(obj);
        setStatus("ready");
      },
      undefined,
      (err) => {
        if (disposed) return;
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Unable to load Anvil.obj");
      },
    );

    const clock = new THREE.Clock();
    const speed = 0.3;

    const animate = () => {
      if (disposed) return;
      frame = window.requestAnimationFrame(animate);
      const delta = clock.getDelta();
      if (model) {
        model.rotation.y += delta * speed;
        model.rotation.z = Math.sin(clock.elapsedTime * 0.6) * 0.08;
      }
      effect.render(scene, camera);
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      effect.domElement.remove();
      renderer.dispose();

      scene.traverse((node) => {
        const mesh = node as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            material.dispose();
          }
        }
      });
    };
  }, [modelUrl]);

  return (
    <div className={props.className} aria-label="Anvil model ascii preview">
      <div ref={containerRef} className="anvil-ascii-canvas" />
      {status === "error" && errorMessage ? (
        <div className="anvil-ascii-error">
          <strong>anvil model not loaded</strong>
          <small>
            Put the file at <code>public/models/Anvil.obj</code>. ({errorMessage})
          </small>
        </div>
      ) : null}
    </div>
  );
}

