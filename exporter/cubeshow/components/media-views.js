/* global performance THREE AFRAME NAF MediaStream process setTimeout */
import GIFWorker from "../workers/gifparsing.worker.js";
import errorImageSrc from "!!url-loader!../assets/images/media-error.gif";
import { paths } from "../systems/userinput/paths";
import HLS from "hls.js/dist/hls.light.js";
import { proxiedUrlFor } from "../utils/media-utils";
import { buildAbsoluteURL } from "url-toolkit";

export const VOLUME_LABELS = [];
for (let i = 0; i <= 20; i++) {
  let s = "|";
  for (let j = 0; j <= 20; j++) {
    s += i >= j ? "|" : " ";
  }
  s += "|";
  VOLUME_LABELS[i] = s;
}

class GIFTexture extends THREE.Texture {
  constructor(frames, delays, disposals) {
    super(document.createElement("canvas"));
    this.image.width = frames[0].width;
    this.image.height = frames[0].height;

    this._ctx = this.image.getContext("2d");

    this.generateMipmaps = false;
    this.isVideoTexture = true;
    this.minFilter = THREE.NearestFilter;

    this.frames = frames;
    this.delays = delays;
    this.disposals = disposals;

    this.frame = 0;
    this.frameStartTime = Date.now();
  }

  update() {
    if (!this.frames || !this.delays || !this.disposals) return;
    const now = Date.now();
    if (now - this.frameStartTime > this.delays[this.frame]) {
      if (this.disposals[this.frame] === 2) {
        this._ctx.clearRect(0, 0, this.image.width, this.image.width);
      }
      this.frame = (this.frame + 1) % this.frames.length;
      this.frameStartTime = now;
      this._ctx.drawImage(this.frames[this.frame], 0, 0, this.image.width, this.image.height);
      this.needsUpdate = true;
    }
  }
}

async function createGIFTexture(url) {
  return new Promise((resolve, reject) => {
    // TODO: pool workers
    const worker = new GIFWorker();
    worker.onmessage = e => {
      const [success, frames, delays, disposals] = e.data;
      if (!success) {
        reject(`error loading gif: ${e.data[1]}`);
        return;
      }

      let loadCnt = 0;
      for (let i = 0; i < frames.length; i++) {
        const img = new Image();
        img.onload = e => {
          loadCnt++;
          frames[i] = e.target;
          if (loadCnt === frames.length) {
            const texture = new GIFTexture(frames, delays, disposals);
            texture.image.src = url;
            texture.encoding = THREE.sRGBEncoding;
            texture.minFilter = THREE.LinearFilter;
            resolve(texture);
          }
        };
        img.src = frames[i];
      }
    };
    fetch(url, { mode: "cors" })
      .then(r => r.arrayBuffer())
      .then(rawImageData => {
        worker.postMessage(rawImageData, [rawImageData]);
      })
      .catch(reject);
  });
}

const isIOS = AFRAME.utils.device.isIOS();

/**
 * Create video element to be used as a texture.
 *
 * @param {string} src - Url to a video file.
 * @returns {Element} Video element.
 */
async function createVideoEl() {
  const videoEl = document.createElement("video");
  videoEl.setAttribute("playsinline", "");
  videoEl.setAttribute("webkit-playsinline", "");
  // iOS Safari requires the autoplay attribute, or it won't play the video at all.
  videoEl.autoplay = true;
  // iOS Safari will not play videos without user interaction. We mute the video so that it can autoplay and then
  // allow the user to unmute it with an interaction in the unmute-video-button component.
  videoEl.muted = isIOS;
  videoEl.preload = "auto";
  videoEl.crossOrigin = "anonymous";

  return videoEl;
}

function createVideoTexture(url, contentType) {
  return new Promise(async (resolve, reject) => {
    const videoEl = await createVideoEl();

    const texture = new THREE.VideoTexture(videoEl);
    texture.minFilter = THREE.LinearFilter;
    texture.encoding = THREE.sRGBEncoding;

    if (url.startsWith("hubs://")) {
      const streamClientId = url.substring(7).split("/")[1]; // /clients/<client id>/video is only URL for now
      const stream = await NAF.connection.adapter.getMediaStream(streamClientId, "video");
      videoEl.srcObject = new MediaStream(stream.getVideoTracks());
      // If hls.js is supported we always use it as it gives us better events
    } else if (AFRAME.utils.material.isHLS(url, contentType)) {
      if (HLS.isSupported()) {
        const corsProxyPrefix = `https://${process.env.CORS_PROXY_SERVER}/`;
        const baseUrl = url.startsWith(corsProxyPrefix) ? url.substring(corsProxyPrefix.length) : url;
        const hls = new HLS({
          xhrSetup: (xhr, u) => {
            if (u.startsWith(corsProxyPrefix)) {
              u = u.substring(corsProxyPrefix.length);
            }

            // HACK HLS.js resolves relative urls internally, but our CORS proxying screws it up. Resolve relative to the original unproxied url.
            // TODO extend HLS.js to allow overriding of its internal resolving instead
            if (!u.startsWith("http")) {
              u = buildAbsoluteURL(baseUrl, u.startsWith("/") ? u : `/${u}`);
            }

            xhr.open("GET", proxiedUrlFor(u));
          }
        });
        texture.hls = hls;
        hls.loadSource(url);
        hls.attachMedia(videoEl);
        hls.on(HLS.Events.ERROR, function(event, data) {
          if (data.fatal) {
            switch (data.type) {
              case HLS.ErrorTypes.NETWORK_ERROR:
                // try to recover network error
                hls.startLoad();
                break;
              case HLS.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                reject(event);
                return;
            }
          }
        });
        // If not, see if native support will work
      } else if (videoEl.canPlayType(contentType)) {
        videoEl.src = url;
        videoEl.onerror = reject;
      } else {
        reject("HLS unsupported");
      }
    } else {
      videoEl.src = url;
      videoEl.onerror = reject;
    }

    let hasResolved = false;

    const resolveOnce = () => {
      if (hasResolved) return;
      hasResolved = true;
      resolve(texture);
    };

    videoEl.addEventListener("canplay", resolveOnce, { once: true });

    // HACK: Sometimes iOS fails to fire the canplay event, so we poll for the video dimensions to appear instead.
    if (isIOS) {
      const poll = () => {
        if ((texture.image.videoHeight || texture.image.height) && (texture.image.videoWidth || texture.image.width)) {
          resolveOnce();
        } else {
          setTimeout(poll, 500);
        }
      };

      poll();
    }
  });
}

function fitToTexture(el, texture) {
  const ratio =
    (texture.image.videoHeight || texture.image.height || 1.0) /
    (texture.image.videoWidth || texture.image.width || 1.0);
  const width = Math.min(1.0, 1.0 / ratio);
  const height = Math.min(1.0, ratio);
  el.object3DMap.mesh.scale.set(width, height, 1);
  el.object3DMap.mesh.matrixNeedsUpdate = true;
}

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");
function createImageTexture(url) {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      texture => {
        texture.encoding = THREE.sRGBEncoding;
        texture.minFilter = THREE.LinearFilter;
        resolve(texture);
      },
      null,
      function(xhr) {
        reject(`'${url}' could not be fetched (Error code: ${xhr.status}; Response: ${xhr.statusText})`);
      }
    );
  });
}

function disposeTexture(texture) {
  if (texture.image instanceof HTMLVideoElement) {
    const video = texture.image;
    video.pause();
    video.src = "";
    video.load();
  }

  if (texture.hls) {
    texture.hls.destroy();
  }

  texture.dispose();
}

class TextureCache {
  cache = new Map();

  set(src, texture) {
    this.cache.set(src, {
      texture,
      count: 0
    });
    this.retain(src);
  }

  has(src) {
    return this.cache.has(src);
  }

  get(src) {
    return this.cache.get(src).texture;
  }

  retain(src) {
    const cacheItem = this.cache.get(src);
    cacheItem.count++;
    // console.log("retain", src, cacheItem.count);
    return cacheItem.texture;
  }

  release(src) {
    const cacheItem = this.cache.get(src);
    cacheItem.count--;
    // console.log("release", src, cacheItem.count);
    if (cacheItem.count <= 0) {
      // Unload the video element to prevent it from continuing to play in the background
      disposeTexture(cacheItem.texture);
      this.cache.delete(src);
    }
  }
}

const textureCache = new TextureCache();

const errorImage = new Image();
errorImage.src = errorImageSrc;
const errorTexture = new THREE.Texture(errorImage);
errorTexture.magFilter = THREE.NearestFilter;
errorImage.onload = () => {
  errorTexture.needsUpdate = true;
};

function timeFmt(t) {
  let s = Math.floor(t),
    h = Math.floor(s / 3600);
  s -= h * 3600;
  let m = Math.floor(s / 60);
  s -= m * 60;
  if (h < 10) h = `0${h}`;
  if (m < 10) m = `0${m}`;
  if (s < 10) s = `0${s}`;
  return h === "00" ? `${m}:${s}` : `${h}:${m}:${s}`;
}

AFRAME.registerComponent("media-video", {
  schema: {
    src: { type: "string" },
    contentType: { type: "string" },
    volume: { type: "number", default: 0.5 },
    loop: { type: "boolean", default: true },
    audioType: { type: "string", default: "pannernode" },
    hidePlaybackControls: { type: "boolean", default: false },
    distanceModel: { type: "string", default: "inverse" },
    rolloffFactor: { type: "number", default: 1 },
    refDistance: { type: "number", default: 1 },
    maxDistance: { type: "number", default: 10000 },
    coneInnerAngle: { type: "number", default: 360 },
    coneOuterAngle: { type: "number", default: 0 },
    coneOuterGain: { type: "number", default: 0 },
    videoPaused: { type: "boolean" },
    projection: { type: "string", default: "flat" },
    time: { type: "number" },
    tickRate: { default: 1000 }, // ms interval to send time interval updates
    syncTolerance: { default: 2 }
  },

  init() {
    this.onPauseStateChange = this.onPauseStateChange.bind(this);
    this.tryUpdateVideoPlaybackState = this.tryUpdateVideoPlaybackState.bind(this);

    this.seekForward = this.seekForward.bind(this);
    this.seekBack = this.seekBack.bind(this);
    this.volumeUp = this.volumeUp.bind(this);
    this.volumeDown = this.volumeDown.bind(this);
    this.changeVolumeBy = this.changeVolumeBy.bind(this);
    this.togglePlaying = this.togglePlaying.bind(this);

    this.lastUpdate = 0;
    this.videoMutedAt = 0;

    this.el.setAttribute("hover-menu__video", { template: "#video-hover-menu", dirs: ["forward", "back"] });
    this.el.components["hover-menu__video"].getHoverMenu().then(menu => {
      // If we got removed while waiting, do nothing.
      if (!this.el.parentNode) return;

      this.hoverMenu = menu;

      this.playbackControls = this.el.querySelector(".video-playback");
      this.playPauseButton = this.el.querySelector(".video-playpause-button");
      this.volumeUpButton = this.el.querySelector(".video-volume-up-button");
      this.volumeDownButton = this.el.querySelector(".video-volume-down-button");
      this.seekForwardButton = this.el.querySelector(".video-seek-forward-button");
      this.seekBackButton = this.el.querySelector(".video-seek-back-button");
      this.timeLabel = this.el.querySelector(".video-time-label");
      this.volumeLabel = this.el.querySelector(".video-volume-label");

      this.playPauseButton.object3D.addEventListener("interact", this.togglePlaying);
      this.seekForwardButton.object3D.addEventListener("interact", this.seekForward);
      this.seekBackButton.object3D.addEventListener("interact", this.seekBack);
      this.volumeUpButton.object3D.addEventListener("interact", this.volumeUp);
      this.volumeDownButton.object3D.addEventListener("interact", this.volumeDown);

      this.updateVolumeLabel();
      this.updateHoverMenuBasedOnLiveState();
      this.updatePlaybackState();
    });

    NAF.utils.getNetworkedEntity(this.el).then(networkedEl => {
      this.networkedEl = networkedEl;
      this.updatePlaybackState();

      // For scene-owned videos, take ownership after a random delay if nobody
      // else has so there is a timekeeper. Do not due this on iOS because iOS has an
      // annoying "auto-pause" feature that forces one non-autoplaying video to play
      // at once, which will pause the videos for everyone in the room if owned.
      if (!isIOS && NAF.utils.getNetworkOwner(this.networkedEl) === "scene") {
        setTimeout(() => {
          if (NAF.utils.getNetworkOwner(this.networkedEl) === "scene") {
            NAF.utils.takeOwnership(this.networkedEl);
          }
        }, 2000 + Math.floor(Math.random() * 2000));
      }
    });

    // from a-sound
    const sceneEl = this.el.sceneEl;
    sceneEl.audioListener = sceneEl.audioListener || new THREE.AudioListener();
    if (sceneEl.camera) {
      sceneEl.camera.add(sceneEl.audioListener);
    }
    sceneEl.addEventListener("camera-set-active", function(evt) {
      evt.detail.cameraEl.getObject3D("camera").add(sceneEl.audioListener);
    });
  },

  seekForward() {
    if ((!this.videoIsLive && NAF.utils.isMine(this.networkedEl)) || NAF.utils.takeOwnership(this.networkedEl)) {
      this.video.currentTime += 30;
      this.el.setAttribute("media-video", "time", this.video.currentTime);
    }
  },

  seekBack() {
    if ((!this.videoIsLive && NAF.utils.isMine(this.networkedEl)) || NAF.utils.takeOwnership(this.networkedEl)) {
      this.video.currentTime -= 10;
      this.el.setAttribute("media-video", "time", this.video.currentTime);
    }
  },

  changeVolumeBy(v) {
    this.el.setAttribute("media-video", "volume", THREE.Math.clamp(this.data.volume + v, 0, 1));
    this.updateVolumeLabel();
  },

  volumeUp() {
    this.changeVolumeBy(0.1);
  },

  volumeDown() {
    this.changeVolumeBy(-0.1);
  },

  togglePlaying() {
    // See onPauseStateChanged for note about iOS
    if (isIOS && this.video.paused && NAF.utils.isMine(this.networkedEl)) {
      this.video.play();
      return;
    }

    if (this.networkedEl && (NAF.utils.isMine(this.networkedEl) || NAF.utils.takeOwnership(this.networkedEl))) {
      this.tryUpdateVideoPlaybackState(!this.data.videoPaused);
    }
  },

  onPauseStateChange() {
    // iOS Safari will auto-pause other videos if one is manually started (not autoplayed.) So, to keep things
    // easy to reason about, we *never* broadcast pauses from iOS.
    //
    // if an iOS safari user pauses and plays a video they'll pause all the other videos,
    // which isn't great, but this check will at least ensure they don't pause those videos
    // for all other users in the room! Of course, if they go and hit play on those videos auto-paused,
    // they will become the timekeeper, and will seek everyone to where the video was auto-paused.
    //
    // This specific case will diverge the network schema and the video player state, so that
    // this.data.videoPaused is false (so others will keep playing it) but our local player will
    // have stopped. So we deal with this special case as well when we press the play button.
    if (isIOS && this.video.paused && NAF.utils.isMine(this.networkedEl)) {
      return;
    }

    this.el.setAttribute("media-video", "videoPaused", this.video.paused);

    if (this.networkedEl && NAF.utils.isMine(this.networkedEl)) {
      this.el.emit("owned-video-state-changed");
    }
  },

  updatePlaybackState(force) {
    if (this.hoverMenu) {
      this.playbackControls.object3D.visible = !this.data.hidePlaybackControls && !!this.video;
      this.timeLabel.object3D.visible = !this.data.hidePlaybackControls;

      this.playPauseButton.object3D.visible = !!this.video;
      this.seekForwardButton.object3D.visible = !!this.video && !this.videoIsLive;
      this.seekBackButton.object3D.visible = !!this.video && !this.videoIsLive;
    }

    // Only update playback position for videos you don't own
    if (force || (this.networkedEl && !NAF.utils.isMine(this.networkedEl) && this.video)) {
      if (Math.abs(this.data.time - this.video.currentTime) > this.data.syncTolerance) {
        this.tryUpdateVideoPlaybackState(this.data.videoPaused, this.data.time);
      } else {
        this.tryUpdateVideoPlaybackState(this.data.videoPaused);
      }
    }

    // Volume is local, always update it
    if (this.audio) {
      this.audio.gain.gain.value = this.data.volume;
    }
  },

  tryUpdateVideoPlaybackState(pause, currentTime) {
    if (this._playbackStateChangeTimeout) {
      clearTimeout(this._playbackStateChangeTimeout);
      delete this._playbackStateChangeTimeout;
    }

    if (!this.videoIsLive && currentTime !== undefined) {
      this.video.currentTime = currentTime;
    }

    if (this.hoverMenu) {
      this.playPauseButton.setAttribute("icon-button", "active", pause);
    }

    if (pause) {
      this.video.pause();
    } else {
      // Need to deal with the fact play() may fail if user has not interacted with browser yet.
      this.video.play().catch(() => {
        this._playbackStateChangeTimeout = setTimeout(() => this.tryUpdateVideoPlaybackState(pause, currentTime), 1000);
      });
    }
  },

  async update(oldData) {
    const { src } = this.data;

    this.updatePlaybackState();

    if (!src || src === oldData.src) return;

    this.cleanUp();
    if (this.mesh && this.mesh.material) {
      this.mesh.material.map = null;
      this.mesh.material.needsUpdate = true;
    }

    let texture;
    try {
      texture = await createVideoTexture(src, this.data.contentType);

      // No way to cancel promises, so if src has changed while we were creating the texture just throw it away.
      if (this.data.src !== src) {
        disposeTexture(texture);
        return;
      }

      if (!src.startsWith("hubs://")) {
        // TODO FF error here if binding mediastream: The captured HTMLMediaElement is playing a MediaStream. Applying volume or mute status is not currently supported -- not an issue since we have no audio atm in shared video.
        texture.audioSource = this.el.sceneEl.audioListener.context.createMediaElementSource(texture.image);

        if (this.data.audioType === "pannernode") {
          this.audio = new THREE.PositionalAudio(this.el.sceneEl.audioListener);
          this.audio.setDistanceModel(this.data.distanceModel);
          this.audio.setRolloffFactor(this.data.rolloffFactor);
          this.audio.setRefDistance(this.data.refDistance);
          this.audio.setMaxDistance(this.data.maxDistance);
          this.audio.panner.coneInnerAngle = this.data.coneInnerAngle;
          this.audio.panner.coneOuterAngle = this.data.coneOuterAngle;
          this.audio.panner.coneOuterGain = this.data.coneOuterGain;
        } else {
          this.audio = new THREE.Audio(this.el.sceneEl.audioListener);
        }

        this.audio.setNodeSource(texture.audioSource);
        this.el.setObject3D("sound", this.audio);
      }

      this.video = texture.image;
      this.video.loop = this.data.loop;
      this.video.addEventListener("pause", this.onPauseStateChange);
      this.video.addEventListener("play", this.onPauseStateChange);

      if (texture.hls) {
        const updateLiveState = () => {
          this.videoIsLive = texture.hls.levels[texture.hls.currentLevel].details.live;
          this.updateHoverMenuBasedOnLiveState();
        };
        texture.hls.on(HLS.Events.LEVEL_SWITCHED, updateLiveState);
        if (texture.hls.currentLevel >= 0) {
          updateLiveState();
        }
      } else {
        this.videoIsLive = this.video.duration === Infinity;
        this.updateHoverMenuBasedOnLiveState();
      }

      if (isIOS) {
        const template = document.getElementById("video-unmute");
        this.el.appendChild(document.importNode(template.content, true));
        this.el.setAttribute("position-at-box-shape-border__unmute-ui", {
          target: ".unmute-ui",
          dirs: ["forward", "back"]
        });
      }
    } catch (e) {
      console.error("Error loading video", this.data.src, e);
      texture = errorTexture;
    }

    const projection = this.data.projection;

    if (!this.mesh || projection !== oldData.projection) {
      const material = new THREE.MeshBasicMaterial();

      let geometry;

      if (projection === "360-equirectangular") {
        geometry = new THREE.SphereBufferGeometry(1, 64, 32);
        // invert the geometry on the x-axis so that all of the faces point inward
        geometry.scale(-1, 1, 1);
      } else {
        geometry = new THREE.PlaneBufferGeometry();
        material.side = THREE.DoubleSide;
      }

      this.mesh = new THREE.Mesh(geometry, material);
      this.el.setObject3D("mesh", this.mesh);
    }

    this.mesh.material.map = texture;
    this.mesh.material.needsUpdate = true;

    if (projection === "flat") {
      fitToTexture(this.el, texture);
    }

    this.updatePlaybackState(true);

    if (this.video.muted) {
      this.videoMutedAt = performance.now();
    }

    this.el.emit("video-loaded");
  },

  updateHoverMenuBasedOnLiveState() {
    if (!this.hoverMenu) return;

    this.seekForwardButton.object3D.visible = !this.videoIsLive;
    this.seekBackButton.object3D.visible = !this.videoIsLive;

    if (this.videoIsLive) {
      this.timeLabel.setAttribute("text", "value", "LIVE");
    }
  },

  updateVolumeLabel() {
    this.volumeLabel.setAttribute(
      "text",
      "value",
      this.data.volume === 0 ? "MUTE" : VOLUME_LABELS[Math.floor(this.data.volume / 0.05)]
    );
  },

  tick() {
    if (!this.video) return;

    const userinput = this.el.sceneEl.systems.userinput;
    const interaction = this.el.sceneEl.systems.interaction;
    const volumeMod = userinput.get(paths.actions.cursor.mediaVolumeMod);
    if (interaction.state.rightRemote.hovered === this.el && volumeMod) {
      this.changeVolumeBy(volumeMod);
    }

    if (this.hoverMenu && this.hoverMenu.object3D.visible && !this.videoIsLive) {
      this.timeLabel.setAttribute(
        "text",
        "value",
        `${timeFmt(this.video.currentTime)} / ${timeFmt(this.video.duration)}`
      );
    }

    // If a non-live video is currently playing and we own it, send out time updates
    if (!this.data.videoPaused && !this.videoIsLive && this.networkedEl && NAF.utils.isMine(this.networkedEl)) {
      const now = performance.now();
      if (now - this.lastUpdate > this.data.tickRate) {
        this.el.setAttribute("media-video", "time", this.video.currentTime);
        this.lastUpdate = now;
      }
    }
  },

  cleanUp() {
    if (this.mesh && this.mesh.material) {
      disposeTexture(this.mesh.material.map);
    }
  },

  remove() {
    this.cleanUp();

    if (this.audio) {
      this.el.removeObject3D("sound");
      this.audio.disconnect();
      delete this.audio;
    }

    if (this.video) {
      this.video.removeEventListener("pause", this.onPauseStateChange);
      this.video.removeEventListener("play", this.onPauseStateChange);
    }
    if (this.hoverMenu) {
      this.playPauseButton.object3D.removeEventListener("interact", this.togglePlaying);
      this.volumeUpButton.object3D.removeEventListener("interact", this.volumeUp);
      this.volumeDownButton.object3D.removeEventListener("interact", this.volumeDown);
      this.seekForwardButton.object3D.removeEventListener("interact", this.seekForward);
      this.seekBackButton.object3D.removeEventListener("interact", this.seekBack);
    }
  }
});

AFRAME.registerComponent("media-image", {
  schema: {
    src: { type: "string" },
    projection: { type: "string", default: "flat" },
    contentType: { type: "string" }
  },

  remove() {
    textureCache.release(this.data.src);
  },

  async update(oldData) {
    let texture;
    try {
      const { src, contentType } = this.data;
      if (!src) return;

      this.el.emit("image-loading");

      if (this.mesh && this.mesh.map && src !== oldData.src) {
        this.mesh.material.map = null;
        this.mesh.material.needsUpdate = true;
        if (this.mesh.map !== errorTexture) {
          textureCache.release(oldData.src);
        }
      }

      if (textureCache.has(src)) {
        texture = textureCache.retain(src);
      } else {
        if (src === "error") {
          texture = errorTexture;
        } else if (contentType.includes("image/gif")) {
          texture = await createGIFTexture(src);
        } else if (contentType.startsWith("image/")) {
          texture = await createImageTexture(src);
        } else {
          throw new Error(`Unknown image content type: ${contentType}`);
        }

        textureCache.set(src, texture);

        // No way to cancel promises, so if src has changed while we were creating the texture just throw it away.
        if (this.data.src !== src) {
          textureCache.release(src);
          return;
        }
      }
    } catch (e) {
      console.error("Error loading image", this.data.src, e);
      texture = errorTexture;
    }

    const projection = this.data.projection;

    if (!this.mesh || projection !== oldData.projection) {
      const material = new THREE.MeshBasicMaterial();

      let geometry;

      if (projection === "360-equirectangular") {
        geometry = new THREE.SphereBufferGeometry(1, 64, 32);
        // invert the geometry on the x-axis so that all of the faces point inward
        geometry.scale(-1, 1, 1);
      } else {
        geometry = new THREE.PlaneBufferGeometry(1, 1, 1, 1, texture.flipY);
        material.side = THREE.DoubleSide;
      }

      this.mesh = new THREE.Mesh(geometry, material);
      this.el.setObject3D("mesh", this.mesh);
    }

    this.mesh.material.map = texture;
    this.mesh.material.transparent = texture.format === THREE.RGBAFormat;
    this.mesh.material.needsUpdate = true;

    if (projection === "flat") {
      fitToTexture(this.el, texture);
    }

    this.el.emit("image-loaded", { src: this.data.src });
  }
});
