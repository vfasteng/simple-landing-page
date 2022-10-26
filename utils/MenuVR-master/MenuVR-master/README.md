# MenuVR
A user friendly menu to use in an a-frame scene.

Example :
```javascript
var menu ;
    
var expl_menu = { 
    'start' :    function(){ alert('Start with option values : '+JSON.stringify(menu.values)); },
    'options' : { 
        'dark':true,                                                                // values are boolean and default is true
        'nb lives':[1,2,3],
        'difficulty': ['easy','normal','hard']
    },
    'about':    'A text\nwith many lines\nand some informations',
    'exit':     function(){alert('quit')}
};
window.addEventListener('load',function(){
    var menu = new MenuVR(expl_menu);
//    var menu = new MenuVR(expl_menu,{line_height:0.2,fonts:'mono'});              // an other example
});
```


Screenshot :

![screenshot](MenuVR_example.gif)



**TODO :**
  - MenuVR.onchange()
  - image value
  - int value
  - customise text color
  - ...

[ Donate :coffee: :beer: :tropical_drink: for my work and to improve it :wink: ](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=ZKUXBB8QFHHSQ)
