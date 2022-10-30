var scene;

var t = setInterval(() => {
    scene = document.querySelector('a-scene');
    if(scene != null){
        clearInterval(t);
        setElevatorButtons();
    }
},100);

const setElevatorButtons = function () {
    var pos = [['-1.53 9.34 -5.03', '-1.53 14.14 -5.03'], ['-1.53 4.14 -5.24', '-1.53 14.14 -5.24'], ['-1.53 4.14 -5.46', '-1.53 9.34 -5.46']];
    for (i = 0; i < pos.length; i++) {
        for (j = 0; j < pos[i].length; j++) {
            const entityEl = document.createElement('a-entity');
            entityEl.setAttribute('is-remote-hover-target', '');
            entityEl.setAttribute('class', 'interactable');
            entityEl.setAttribute('tags',  'singleActionButton: true');
            entityEl.setAttribute('elevator', i);
    
            const box = document.createElement('a-box');
            box.setAttribute('scale', '0.15 0.15 0.015');
            box.setAttribute('position', pos[i][j]);
            box.setAttribute('rotation', '180 270 0');
            box.setAttribute('material', 'opacity: 0.0; transparent: true');
            entityEl.appendChild(box);
            scene.appendChild(entityEl);
        }
    }
};

AFRAME.registerComponent('elevator', {

    init () {
        this.onClick = () => {
            const playerRig = document.querySelector("#player-rig").components["character-controller"];
            switch (this.attrValue) {
                case 0:
                    playerRig.teleportTo({x:0, y:2.9, z:-5.24});
                    break;
                case 1:
                    playerRig.teleportTo({x:0, y:7.9, z:-5.24});
                    break;
                case 2:
                    playerRig.teleportTo({x:0, y:12.9, z:-5.24});
                    break;
            }
        },
        this.el.object3D.addEventListener('interact', this.onClick);
    }

});