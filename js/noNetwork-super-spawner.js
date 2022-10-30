AFRAME.registerComponent("noNetwork-super-spawner", {
  schema: {
    /**
     * Source of the media asset the spawner will spawn when grabbed. This can be a gltf, video, or image, or a url that the reticiulm media API can resolve to a gltf, video, or image.
     */
    src: { default: "https://cdn.glitch.com/2a3af8bb-e7b2-4e50-8ce2-68e3e8cf4538%2Fgear16.glb?v=1600564034432" },

    /**
     * Whether to use the Reticulum media resolution API to interpret the src URL (e.g. find a video URL for Youtube videos.)
     */
    resolve: { default: false },

    /**
     * Whether to resize the media on load.
     */
    resize: { default: false },

    /**
     * The template to use for this object
     */
    template: { default: "" },

    /**
     * Spawn the object at a custom position, rather than at the center of the spanwer.
     */
    useCustomSpawnPosition: { default: true },
    spawnPosition: { type: "vec3" },

    /**
     * Spawn the object with a custom orientation, rather than copying that of the spawner.
     */
    useCustomSpawnRotation: { default: true },
    spawnRotation: { type: "vec4" },

    /**
     * Spawn the object with a custom scale, rather than copying that of the spawner.
     */
    useCustomSpawnScale: { default: true },
    spawnScale: { type: "vec3" },

    /**
     * The spawner will become invisible and ungrabbable for this ammount of time after being grabbed. This can prevent rapidly spawning objects.
     */
    spawnCooldown: { default: 1 },

    /**
     * Center the spawned object on the hand that grabbed it after it finishes loading. By default the object will be grabbed relative to where the spawner was grabbed
     */
    centerSpawnedObject: { default: false },

    /**
     * Optional event to listen for to spawn an object on the preferred superHand
     */
    spawnEvent: { type: "string" },

    /**
     * If true, will spawn the object at the cursor and animate it into the hand.
     */
    animateFromCursor: { type: "boolean" }
  },

  init() {
    this.cooldownTimeout = null;
    this.handPosition = new THREE.Vector3();

    this.onSpawnEvent = this.onSpawnEvent.bind(this);

    this.sceneEl = document.querySelector("a-scene");

    this.tempSpawnHandPosition = new THREE.Vector3();
  },

  play() {
    if (this.data.spawnEvent) {
      this.el.sceneEl.addEventListener(this.data.spawnEvent, this.onSpawnEvent);
    }
  },

  pause() {
    if (this.data.spawnEvent) {
      this.el.sceneEl.removeEventListener(this.data.spawnEvent, this.onSpawnEvent);
    }
    if (this.cooldownTimeout) {
      clearTimeout(this.cooldownTimeout);
      this.cooldownTimeout = null;
      this.el.setAttribute("visible", true);
      this.el.classList.add("interactable");
    }
  },

  async onSpawnEvent() {
    if (this.cooldownTimeout) {
      return;
    }

    const entity = addMedia(this.data.src, this.data.template, ObjectContentOrigins.SPAWNER, this.data.resolve, false)
      .entity;

    const cursor = document.querySelector("#cursor");
    cursor.object3D.getWorldPosition(entity.object3D.position);
    cursor.object3D.getWorldQuaternion(entity.object3D.quaternion);
    entity.object3D.matrixNeedsUpdate = true;

    if (this.data.useCustomSpawnScale) {
      entity.object3D.scale.copy(this.data.spawnScale);
    }

    const userinput = AFRAME.scenes[0].systems.userinput;
    const interaction = AFRAME.scenes[0].systems.interaction;
    const willAnimateFromCursor =
      this.data.animateFromCursor && userinput.get(paths.actions.rightHand.matrix) && !AFRAME.utils.device.isMobileVR();
    if (!willAnimateFromCursor) {
      interaction.state.rightRemote.held = entity;
      interaction.state.rightRemote.spawning = true;
    }
    this.activateCooldown();
    await waitForEvent("body-loaded", entity);

    cursor.object3D.getWorldPosition(entity.object3D.position);
    cursor.object3D.getWorldQuaternion(entity.object3D.quaternion);
    entity.object3D.matrixNeedsUpdate = true;

    if (willAnimateFromCursor) {
      document.querySelector("#player-right-controller").object3D.getWorldPosition(this.handPosition);
      entity.setAttribute("animation__spawn-at-cursor", {
        property: "position",
        delay: 500,
        dur: 1500,
        from: { x: entity.object3D.position.x, y: entity.object3D.position.y, z: entity.object3D.position.z },
        to: { x: this.handPosition.x, y: this.handPosition.y, z: this.handPosition.z },
        easing: "easeInOutBack"
      });
    } else {
      interaction.state.rightRemote.spawning = false;
    }
    entity.components["ammo-body"].syncToPhysics();
  },

  activateCooldown() {
    if (this.data.spawnCooldown > 0) {
      const [sx, sy, sz] = [this.el.object3D.scale.x, this.el.object3D.scale.y, this.el.object3D.scale.z];

      this.el.setAttribute("visible", false);
      this.el.object3D.scale.set(0.001, 0.001, 0.001);
      this.el.object3D.matrixNeedsUpdate = true;
      this.el.classList.remove("interactable");
      this.el.setAttribute("ammo-body", { collisionFilterMask: COLLISION_LAYERS.NONE });
      this.cooldownTimeout = setTimeout(() => {
        this.el.setAttribute("visible", true);
        this.el.classList.add("interactable");
        this.el.setAttribute("ammo-body", { collisionFilterMask: COLLISION_LAYERS.DEFAULT_SPAWNER });
        this.el.removeAttribute("animation__spawner-cooldown");
        this.el.setAttribute("animation__spawner-cooldown", {
          property: "scale",
          delay: 50,
          dur: 350,
          from: { x: 0.001, y: 0.001, z: 0.001 },
          to: { x: sx, y: sy, z: sz },
          easing: "easeOutElastic"
        });

        this.cooldownTimeout = null;
      }, this.data.spawnCooldown * 1000);
    }
  }
});
