// JavaScript source code
//remove entity
entityEl.parentNode.removeChild(entityEl);
If you have a sphere:

var sphere = document.querySelector('a-sphere');
sphere.parentNode.removeChild(sphere);
In a component, we have a reference to the entity via this.el:

AFRAME.registerComponent('remove-on-tick', {
    tick: function () {
        var entity = this.el;
        if (condition) {
            entity.parentNode.removeChild(entity);
        }
    }
});
//

//

//

//

//

//

//

//

//

//