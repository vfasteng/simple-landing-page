// JavaScript source code
 <a-sky material="color: #99aaee"></a-sky>
    </a-scene>
    <script src="dist/aframe-inspector.min.js"></script>
</body>
<script type="text/javascript">
    var hueb = new Huebee('.color-input', {
        // options
        notation: 'hex',
        saturations: 2,
        setText: true,
        customColors: ['#ffffff']
    });
    const ADD = 0;
    const REMOVE = 1;
    const EDIT = 2;
    var state = ADD;
    var cursor3D = document.querySelector('#my-cursor');
    var scene = document.querySelector('a-scene');
    var initialScale = 0.01;
    var rotationYOffset = 0;
    var selected = null;

    var reader = new FileReader();
    var colorIndex = 0;
    var usedColor = 10;
    hueb.on('change', function (color, hue, sat, lum) {
        if (state == ADD && cursor3D.getAttribute('stl-model'))
            cursor3D.setAttribute('material', 'color', color);

        if (state == EDIT && selected)
            selected.setAttribute('material', 'color', color);

        for (var i = 0; i < hueb.options.customColors.length; i++)
            if (hueb.options.customColors[i] == color)
                return;

        hueb.options.customColors[colorIndex] = color;
        hueb.updateColors();
        colorIndex++;
        if (colorIndex > usedColor)
            colorIndex = 0;
    })

    // document.querySelector('#save').addEventListener('click', function() {
    // TODO: save function for electron implementation
    //   scene.flushToDOM(true);
    //   console.log(scene);
    // });
    document.querySelector('#screenshot').addEventListener('click', function () {
        document.querySelector('a-scene').components.screenshot.capture('perspective');
    });
    document.querySelector('#environment').addEventListener('change', function () {
        document.querySelector('#env').setAttribute('environment', 'preset', event.target.value)
        //document.querySelector('#env').setAttribute('environment', 'ground', 'flat');
        //document.querySelector('#env').setAttribute('environment', 'groundYScale', document.querySelector('#env').getAttribute('environment').groundYScale / 2);
        document.querySelector('#env').setAttribute('environment', 'playArea', 1.5);
        //document.querySelector('#env').setAttribute('environment', 'shadow', 'true');
        document.querySelector('#env').setAttribute('environment', 'flatShading', 'true');
        var reducedDressing = document.querySelector('#env').getAttribute('environment').dressingAmount;
        if (reducedDressing > 50)
            document.querySelector('#env').setAttribute('environment', 'dressingAmount', reducedDressing / 2);
    });
    document.querySelector('#add').addEventListener('click', function () {
        state = ADD;
        if (cursor3D.getAttribute('material'))
            hueb.setColor(cursor3D.getAttribute('material').color);
        cursor3D.setAttribute('visible', true);
        document.querySelector('.active').classList.toggle('active');
        document.querySelector('#add').classList.toggle('active');
    });
    document.querySelector('#remove').addEventListener('click', function () {
        state = REMOVE;
        cursor3D.setAttribute('visible', false);
        document.querySelector('.active').classList.toggle('active');
        document.querySelector('#remove').classList.toggle('active');

    });
    document.querySelector('#edit').addEventListener('click', function () {
        state = EDIT;
        cursor3D.setAttribute('visible', false);
        document.querySelector('.active').classList.toggle('active');
        document.querySelector('#edit').classList.toggle('active');

    });
    var inventoryIndex = 0;
    reader.addEventListener("load", function () {
        if (state != ADD)
            return;
        cursor3D.setAttribute('stl-model', { src: reader.result });
        cursor3D.setAttribute('scale', { x: initialScale, y: initialScale, z: initialScale });
        cursor3D.setAttribute('material', 'color', hueb.color);
        var listElement = document.createElement('a-entity')
        listElement.setAttribute('position', { x: -1.8 + (.45 * inventoryIndex), y: -1, z: -1.5 })

        listElement.setAttribute('rotation', { x: -90, y: 0, z: 0 })
        listElement.setAttribute('class', 'ignore-ray');
        listElement.setAttribute('stl-model', { src: reader.result });
        listElement.setAttribute('scale', { x: initialScale * .2, y: initialScale * .2, z: initialScale * .2 });
        var shortCutText = document.createElement('a-entity');
        shortCutText.setAttribute('text', 'value: ' + (inventoryIndex + 1))
        shortCutText.setAttribute('text', 'anchor: left')
        shortCutText.setAttribute('text', 'baseline', "center")
        shortCutText.setAttribute('scale', '1000 1000 1000')
        //shortCutText.setAttribute('position', {x:-2 + (.45 * inventoryIndex), y:-1.15, z: -1.5})
        shortCutText.setAttribute('position', { x: 0, y: 0, z: -90 })
        shortCutText.setAttribute('rotation', { x: 90, y: 0, z: 0 })
        shortCutText.object3D.layers.set(1)
        inventoryIndex++;

        listElement.appendChild(shortCutText)
        document.querySelector('#my-camera').appendChild(listElement)
    }, false);


    scene.addEventListener("drag-and-drop", function (event) {
        var file = event.detail.file;
        reader.readAsDataURL(file);
    });
    window.addEventListener("keydown", function (event) {
        //console.log(event.key)
        if (inventoryIndex + 1 > event.key) {
            //console.log()
            cursor3D.setAttribute('stl-model', document.querySelector('#my-camera').children[event.key].getAttribute('stl-model'))
        }
    }, true)

    window.addEventListener("contextmenu", function (event) {
        if (state == ADD && cursor3D.getAttribute('stl-model') != null) {
            var el = document.createElement('a-entity');
            el.setAttribute('stl-model', cursor3D.getAttribute('stl-model'));
            el.setAttribute('scale', cursor3D.getAttribute('scale'));
            var rotation = { x: THREE.Math.radToDeg(cursor3D.object3D.rotation.x), y: THREE.Math.radToDeg(cursor3D.object3D.rotation.y), z: THREE.Math.radToDeg(cursor3D.object3D.rotation.z) };
            var position = cursor3D.getAttribute('position');
            var material = cursor3D.getAttribute('material');
            el.setAttribute('position', { x: position.x, y: position.y, z: position.z });
            el.setAttribute('rotation', { x: rotation.x, y: rotation.y, z: rotation.z });
            el.setAttribute('material', 'color', material.color);

            el.addEventListener('raycaster-intersected', function () {
                selected = el;

                if (state == EDIT)
                    hueb.setColor(selected.getAttribute('material').color)
            }, true);
            el.addEventListener('raycaster-intersected-cleared', function () {
                selected = null;
            }, true);

            scene.appendChild(el);
        } else if (state == REMOVE && selected) {
            selected.parentNode.removeChild(selected);
            selected = null;
        }
        event.preventDefault();
    });
    //
    window.addEventListener("wheel", function (event) {
        var currentlySelected;
        if (state == ADD) {
            currentlySelected = cursor3D;
        } else if (state == EDIT) {
            currentlySelected = selected;
        }

        if (!currentlySelected)
            return;

        if (!event.ctrlKey) {
            var currentScale = currentlySelected.getAttribute('scale').x;
            var delta = 0.001;
            if (event.shiftKey)
                delta = 0.01;
            if (event.deltaY > 0) {
                delta = -delta;
            }
            currentScale += delta;
            if (currentScale <= 0)
                currentScale = 0.001;

            currentlySelected.setAttribute('scale', { x: currentScale, y: currentScale, z: currentScale });
        } else {
            var currentRotation = currentlySelected.getAttribute('rotation');
            var delta = 5;
            if (event.shiftKey)
                delta = 10;
            if (event.deltaY > 0) {
                delta = -delta;
            }
            currentRotation.y += delta;

            currentlySelected.setAttribute('rotation', { x: currentRotation.x, y: currentRotation.y, z: currentRotation.z });
            //console.log(currentRotation.y);
        }
        event.preventDefault();
        //return true;
    }, true)
    document.addEventListener("wheel", function () {
        event.preventDefault();
    })
</script>