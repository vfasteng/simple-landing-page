/*      MenuVR display a menu in an A-Frame scene
        To use it, we need a menu object and a camera or to give to our camera the ID camera.
        Options :
            father : the node where will be placed the menu. A new entity node will be create if not specified.
            scene : define the scene were will be put canvas entities and the father node of the menu if not specified.
            camera : that's only for the position of the menu, if it's not specified, we need to have the is camera on the camera
            line_height : that's the height of the lines, the default value is 0.3
            reso : this is the text resolution , the default value is 80 ( pt )
            font : this is the font style , default font is Calibri,Geneva,Arial                    */
        
function MenuVR(menu,options){
    this.num_lin_men = 0 ;
    this.father = null ;
    this.scene = null ;
    this.camera = null ;
    this.line_height = 0.3 ;
    this.reso = 80 ;
    this.fonts = 'Calibri,Geneva,Arial';
    this.font_color = '#0014b4' ;
    this.value_color = '#00b414' ;
    this.bg_color = '#ffffff' ;
    this.bg_opacity = 0 ;
    
    this.values = {};
    
    this.make_canvas = function(name,color){
        var ass = document.createElement('a-assets');
        var cnv = document.createElement('canvas');
        cnv.id = 'lin_num_'+this.num_lin_men++ ;
        cnv.height = this.reso*1.375 ;
        var ctx = cnv.getContext('2d'); 
        ctx.font = this.reso+"pt "+this.fonts;
        cnv.width = ctx.measureText(name).width;                                    // set the canvas width on the text width to be easyer to center
        if(this.bg_opacity>0){
            ctx.fillStyle = this.bg_color+ ( this.bg_color<16 ? '0' : '' ) +Math.round(this.bg_opacity*255).toString(16);           // set the background color with opacity [0,1]->[00,ff]
            ctx.fillRect(0,0, 100,100);
        }
        ctx.font = this.reso+"pt "+this.fonts;
        ctx.fillStyle = color;
        ctx.fillText(name, 0, this.reso);
        ass.appendChild(cnv);
        this.scene.appendChild(ass);
        return cnv ;
    };
    this.lay_line = function(father,cnv,pos){
        var ent = document.createElement('a-entity');
        ent.setAttribute('geometry',"primitive: plane;height:"+this.line_height+";width:"+(cnv.width/(this.reso*1.375/this.line_height)) );
        ent.setAttribute('material',"src: #"+cnv.id+";opacity:0.9");
        ent.setAttribute('position',pos.x+' '+pos.y+' '+pos.z);
        ent.setAttribute('draw-canvas',cnv.id);
        father.appendChild(ent);
        return ent ;
    };
    this.lay_line_val = function(father,name,cnv,cnv_v,pos){
        var ent = document.createElement('a-entity');
        ent.setAttribute('geometry',"primitive: plane;height:"+this.line_height+";width:"+cnv.width/this.coef_width );
        ent.setAttribute('material',"src: #"+cnv.id+";opacity:0.9");
        ent.setAttribute('position',(pos.x-(cnv.width/this.coef_width)/2)+' '+pos.y+' '+pos.z);
        ent.setAttribute('draw-canvas',cnv.id);
        father.appendChild(ent);
        var this_val = this.values;
        var ents = [] ;
        for(var value in cnv_v){
            let cnv = cnv_v[value];
            let entmp = document.createElement('a-entity');
            entmp.setAttribute('geometry',"primitive: plane;height:"+this.line_height+";width:"+(cnv.width/this.coef_width) );
            entmp.setAttribute('material',"src: #"+cnv.id+";opacity:0.9");
            entmp.setAttribute('position',(pos.x+(cnv.width/this.coef_width)/2)+' '+pos.y+' '+pos.z);
            entmp.setAttribute('draw-canvas',cnv.id);
            entmp.setAttribute('value',value);
            father.appendChild(entmp);
            if(ents.length>0){
                entmp.setAttribute('visible',false);
                ents[ents.length-1].addEventListener('click', function(){
                    this.setAttribute('visible',false);
                    entmp.setAttribute('visible',true);
                    this_val[name] = entmp.getAttribute('value');
                } );
            }
            ents.push(entmp);
        }
        ents[ents.length-1].addEventListener('click', function(){
            this.setAttribute('visible',false);
            ents[0].setAttribute('visible',true);
            this_val[name] = ents[0].getAttribute('value');
        } );
    };
    this.display_menu = function(father,menu){
        var pos = this.camera.getAttribute('position') ;
        father.setAttribute('position',pos.x+' '+pos.y+' '+(pos.z-1));
        pos = {x:0,z:0, y: (Object.keys(menu).length-1)*this.line_height/2 } ;
        for(var name in menu){
            var cnv = this.make_canvas(name,this.font_color);
            switch( Array.isArray(menu[name])? 'array' : typeof(menu[name]) ){
                case 'boolean' :
                    menu[name] = menu[name]? ['true','false']:['false','true'];
                case 'array' :
                    var cnv_v = [] ;
                    for(var v of menu[name])
                        cnv_v[v] = this.make_canvas(' '+v,this.value_color) ;
                    this.values[name] = menu[name][Object.keys(menu[name])[0]];                 // take the first value
                    this.lay_line_val(father,name,cnv,cnv_v,pos);
                    break ;
                case 'string' :
                    var text = menu[name].split("\n");
                    menu[name] = {} ;
                    for(var t of text)
                        menu[name][t] = function(){} ;
                case 'object' :
                    var ent = document.createElement('a-entity');
                    this.scene.appendChild(ent);
                    ent.setAttribute('visible',false);
                    menu[name]['<-    '] = (function(father,ent){ return function(){father.setAttribute('visible',true);ent.setAttribute('visible',false)} })(father,ent) ;
                    this.display_menu(ent,menu[name]);
                    menu[name] = (function(father,ent){ return function(){father.setAttribute('visible',false);ent.setAttribute('visible',true)} })(father,ent) ;
                case 'function' :
                    var obj3D = this.lay_line(father,cnv,pos);
                    obj3D.addEventListener('click',menu[name]);
            }
            pos.y -= this.line_height ;
        }
    };
    
    for(var n in options)   this[n] = options[n];                                   // set the options parameters
    
    if(this.scene==null)    this.scene = document.getElementsByTagName('a-scene')[0] ; // if there is no scene specified, we take the first a-scene
    if(this.father==null){
        this.father = document.createElement('a-entity');
        this.scene.appendChild(this.father);
    }
    if(this.camera==null)    this.camera = camera ;                                 // if there is no camera specified, we need to have a camera with id camera
    this.coef_width = (this.reso*1.375/this.line_height) ;
    this.display_menu(this.father,menu);
};