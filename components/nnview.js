let last_intersect_check;

//linear scaling.. I think we need inverse log.
Number.prototype.map = function (in_min, in_max, out_min, out_max) {
    return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

Vue.component('nnview', {
    data () {
        return {
            renderer: null,
            //componer: null,

            scene: null, //where rois mesh and tracts goes
            back_scene: null, //to put the black silouette

            camera: null,
            camera_light: null,

            controls: null,

            roi1_pointer: null,
            roi2_pointer: null,

            hoverpair: null, //roi pair hovered on amatrix
            hovered_column: null, //roi mesh hovered on nnview
            pushed_roi: null, 

            loading: false,

            roi_pairs: null, 
            labels: null,
            labels_o: null,

            columns: [], //list of roi (1001, 1002, etc..) in the order we want to display them in

            raycaster: new THREE.Raycaster(),

            gui: new dat.GUI(),
            stats: new Stats(),
            show_stats: false,

            weight_field: 'count',
            min_weight: null,
            max_weight: null,

            tract_opacity: 0.6,
        };
    },

    mounted() {

        //weird way to register fast raycaster
        THREE.BufferGeometry.prototype.computeBoundsTree = window.MeshBVHLib.computeBoundsTree;
        THREE.BufferGeometry.prototype.disposeBoundsTree = window.MeshBVHLib.disposeBoundsTree;
        THREE.Mesh.prototype.raycast = window.MeshBVHLib.acceleratedRaycast;

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

        this.scene = new THREE.Scene();
        this.back_scene = new THREE.Scene();

        let viewbox = this.$refs.view.getBoundingClientRect();
        this.camera = new THREE.PerspectiveCamera(45, viewbox.width / viewbox.height, 1, 1000);
        this.camera.position.z = 200;
        
        var ambientLight = new THREE.AmbientLight(0x505050);
        this.scene.add(ambientLight);

        this.camera_light = new THREE.PointLight(0xffffff, 1);
        this.camera_light.radius = 10;
        this.scene.add(this.camera_light);

        this.stats.showPanel(1);
        this.$refs.stats.appendChild(this.stats.dom);
        this.stats.dom.style.top = null;
        this.stats.dom.style.bottom = "5px";
        this.stats.dom.style.left = null;
        this.stats.dom.style.right = "5px";

        this.load();

        this.renderer.autoClear = false;
        this.renderer.setSize(viewbox.width, viewbox.height);
        this.$refs.view.appendChild(this.renderer.domElement);
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.autoRotate = true;
        this.controls.addEventListener('start', ()=>{
            this.controls.autoRotate = false;
        });

        window.addEventListener("resize", this.resized);

        this.init_gui();
    },

    watch: {
        weight_field(v, oldv) {
            this.compute_minmax();
        }
    },

    methods: {
        compute_minmax() {
            //find min/max value
            let min = null;
            let min_non0 = null;
            let max = null;
            this.roi_pairs.forEach(roi=>{
                let v = roi.weights[this.weight_field];
                if(v < min || min === null) min = v;
                if(v > max || max === null) max = v;
                //roi._selected = false; //this was needed at some point.. to fix some UI bug.
            });
            this.min_weight = min;
            this.max_weight = max;
        },

        init_gui() {
            
            var ui = this.gui.addFolder('UI');
            ui.add(this.controls, 'autoRotate').listen();
            ui.add(this, 'show_stats');
            ui.open();

            var matrix = this.gui.addFolder('Matrix');
            matrix.add(this, 'weight_field',  [ 'count', 'density' ]);
            matrix.open();
        },

        load() {
            //load lables and mesh
            fetch("labels.json").then(res=>{
                return res.json();
            }).then(json=>{
                this.labels = json;

                //convert label name "1001" to 1001 to be consistent
                this.labels.forEach(label=>{label.label = parseInt(label.label);});
                
                //labels lookup by column id
                this.labels_o = this.labels.reduce((a,c)=>{
                    a[c.label] = c;
                    return a;
                }, {});
        
                this.load_pairs();
                this.render();

                let vtkloader = new THREE.VTKLoader();
                async.eachSeries(this.labels, (label, next_label)=>{
                    //only try loading lables that we care..
                    if(!((label.label > 1000 && label.label < 1036) || (label.label > 2000 && label.label < 2036))) return next_label();

                    console.log(label);
                    let vtk = "testdata/surfaces/"+label.label+"."+label.name+".vtk";
                    vtkloader.load(vtk, geometry => {
                        let back_material = new THREE.MeshBasicMaterial({
                            color: new THREE.Color(0,0,0),
                            depthTest: false,
                        });
                        var back_mesh = new THREE.Mesh( geometry, back_material );
                        back_mesh.rotation.x = -Math.PI/2;
                        this.back_scene.add(back_mesh);

                        let roi_material = new THREE.MeshLambertMaterial({
                            color: new THREE.Color(label.color.r/256*0.75, label.color.g/256*0.75, label.color.b/256*0.75),
                        });

                        geometry.computeVertexNormals(); //for smooth shading
                        geometry.computeBoundsTree(); //for BVH

                        var mesh = new THREE.Mesh( geometry, roi_material );
                        mesh.rotation.x = -Math.PI/2;
                        mesh.visible = false;
                        mesh._roi = label.label;

                        this.scene.add(mesh);

                        label._mesh = mesh;
                        label._material = roi_material;
                        //we could also use MeshStandardMetarial
                        //MeshPhongMaterial
                        //MeshLambertMaterial
                        label.__highlight_material = new THREE.MeshPhongMaterial({
                            color: new THREE.Color(label.color.r/256*1.25, label.color.g/256*1.25, label.color.b/256*1.25),
                            shininess: 80,
                        });
                        label.__xray_material = new THREE.MeshLambertMaterial({
                            color: new THREE.Color(label.color.r/256*1.25, label.color.g/256*1.25, label.color.b/256*1.25),
                            transparent: true,
                            opacity: 0.25,
                            depthTest: false,
                        });


                        //geometry.computeBoundingBox();
                        /*
                        //calculate mesh center (for pointers)
                        var center = new THREE.Vector3();
                        geometry.boundingBox.getCenter(center);
                        mesh.localToWorld( center );
                        label._position = center;
                        */

                        this.$forceUpdate();
                        setTimeout(next_label, 0); //yeild to ui
                    }, progress=>{}, err=>{
                        console.error(err);
                        next_label();
                    })
                }, err=>{
                    //finished loading all rois!
                });
            });
        },

        load_pairs() {
    
            fetch("testdata/networkneuro/index.json").then(res=>{
                return res.json();
            }).then(json=>{
                this.roi_pairs = json.roi_pairs;
                this.compute_minmax();  

                //find unique rois
                let columns = this.roi_pairs.reduce((a,c)=>{
                    //roi1
                    let label = this.labels_o[c.roi1];
                    a.add(label.label);
                    //roi2
                    label = this.labels_o[c.roi2];
                    a.add(label.label);
                    return a;
                }, new Set());
                this.columns = [...columns].sort();   

                //load fibers
                let tracts = new THREE.Object3D();
                this.scene.add(tracts);
                this.loading = true;
                let batches = {};

                function create_mesh(pair, coords) {
                    if(!coords) {
                        console.log("invalid coords");
                        console.dir(pair);
                        return;
                    }
                    //console.log("creating mesh for", pair.roi1, pair.roi2)
                    //convert each bundle to threads_pos array
                    var threads_pos = [];
                    if(!Array.isArray(coords)) coords = [coords];
                    coords.forEach(function(fascicle) {
                        var xs = fascicle[0];
                        var ys = fascicle[1];
                        var zs = fascicle[2];
                        for(var i = 1;i < xs.length;++i) {
                            threads_pos.push(xs[i-1]);
                            threads_pos.push(ys[i-1]);
                            threads_pos.push(zs[i-1]);
                            threads_pos.push(xs[i]);
                            threads_pos.push(ys[i]);
                            threads_pos.push(zs[i]);
                        }
                    });
        
                    //then convert that to bufferedgeometry
                    var vertices = new Float32Array(threads_pos);
                    var geometry = new THREE.BufferGeometry();
                    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3 ) );
                    geometry.vertices = vertices;
        
                    //var label = this.labels_o[pair.roi1];
                    var material = new THREE.LineBasicMaterial({
                        color: this.gettractcolor(pair,0.2),
                        transparent: true,
                        opacity: this.tract_opacity,
                        //vertexColors: THREE.VertexColors
                        //depthTest: false,
                        //lights: true, //locks up
                    });
                    var mesh = new THREE.LineSegments( geometry, material );
                    mesh.rotation.x = -Math.PI/2;
                    mesh.visible = false;
                    tracts.add(mesh);
                    pair._mesh = mesh;
                    pair._roi_material = mesh.material; //store original material to restore from animiation

                    //this.$forceUpdate();
                }

                async.eachSeries(this.roi_pairs, (pair, next_pair)=>{
                    if(pair.filename == "") return next_pair();
                    let batch = batches[pair.filename];
                    if(batch === undefined) {
                        this.loading = pair.filename;
                        console.log(pair.filename);
                        fetch("testdata/networkneuro/"+pair.filename).then(res=>{
                            return res.json();
                        }).then(json=>{
                            batches[pair.filename] = json;
                            create_mesh.call(this, pair, json[pair.idx-1]);    
                            setTimeout(next_pair, 0); //yeild to ui
                        });
                    } else {
                        //already loaded.. pick an idx
                        create_mesh.call(this, pair, batch[pair.idx-1]);
                        setTimeout(next_pair, 0); //yeild to ui
                    }
                }, err=>{
                    this.loading = false;
                });
            });
        },

        render() {
            this.stats.begin();

            //animate
            this.controls.update();
            this.camera_light.position.copy(this.camera.position);

            this.update_rois();

            if(this.hoverpair && this.hoverpair._mesh) {
                //pick the milliseconds
                let now = new Date().getTime();
                let l = Math.cos((now%1000)*(2*Math.PI/1000));
                this.hoverpair._mesh.material.opacity = (l+2)/4;
            }

            //render
            this.renderer.clear();
            this.renderer.render(this.back_scene, this.camera);
            this.renderer.clearDepth();
            this.renderer.render(this.scene, this.camera);

            this.stats.end();
            requestAnimationFrame(this.render);
        },

        update_rois() {
            this.scene.children.forEach(mesh=>{
                if(mesh._roi) {
                    //decide if we want to highlight the roila
                    let label = this.labels_o[mesh._roi];
                    let highlight = false;
                    if(this.hovered_column == mesh._roi) highlight = true;      
                    if(this.hoverpair) {
                        if(this.hoverpair.roi1 == label.label) highlight = true;
                        if(this.hoverpair.roi2 == label.label) highlight = true;
                    }
                    if(mesh._roi == this.pushed_roi) mesh.material = label.__xray_material;
                    else if(highlight) mesh.material = label.__highlight_material;
                    else mesh.material = label._material;
                }
            });
        },

        resized() {
            var viewbox = this.$refs.view.getBoundingClientRect();
            this.camera.aspect = viewbox.width / viewbox.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(viewbox.width, viewbox.height);
        },

        getcolor(pair) {
            //default
            let h = 0;
            let s = 10;
            let l = 100;
            let a = 1;


            //return "white";

            //apply alpha using weight
            /*
            switch(this.weight_field) {
            case "count":
                a = Math.max(Math.log(pair.weights.count)/4, 0);
                break;
            case "density":
                a = pair.weights.density.map(this.min_weight, this.max_weight, 0, 1);
                //console.log(a);
                break;
            }
            */
            let v = pair.weights[this.weight_field];
            //let mid_weight = (this.max_weight - this.min_weight)/100; //only show bottom half
            a = v.map(this.min_weight, this.max_weight, 0, 1);
            a = Math.max(a, 0); //crop at 0 or will mess up svg
            /*
            let minp = 0;
            let maxp = 1.0;
            let mid_weight = (this.max_weight - this.min_weight)/100; //crop bottom half
            let minv = Math.log(this.min_weight); 
            let maxv = Math.log(this.max_weight);
            let scale = (maxv-minv)/(maxp-minp);

            let v = pair.weights[this.weight_field];
            a = (Math.log(v)-minv) / scale + minp;
            a = Math.max(a, 0);//clip at 0
            //console.log(v, (Math.log(v)-minv)/scale);
            if(pair.roi1 == "1001" && pair.roi2 == "1002") console.log(mid_weight);
            */

            //not yet loaded
            if(!pair._mesh) {
                s = 50;
                h = 200;
                l = 50;
                //a = 0.5;
            }

            if(pair._selected) {
                s = 100; //maybe I should use weights for this to show the original weight?
                l = 50; //need to be 50 or gets too pink
                h = 0;
                a = 1.0;
            } else {
                //check what we are hovering on
                let hover_label1;
                let hover_label2;
                if(this.hoverpair) {
                    if(pair.roi1 == this.hoverpair.roi1) hover_label1 = this.labels_o[this.hoverpair.roi1];
                    if(pair.roi2 == this.hoverpair.roi2) hover_label2 = this.labels_o[this.hoverpair.roi2];
                }
                if(this.hovered_column) {
                    var label = this.labels_o[this.hovered_column];
                    if(pair.roi1 == label.label) hover_label1 = label;
                    if(pair.roi2 == label.label) hover_label2 = label;
                }

                //then decide the color
                if(hover_label1 || hover_label2) {
                    //get roi color
                    let color;
                    if(hover_label1 && pair.roi1 == hover_label1.label) color = hover_label1.color;
                    if(hover_label2 && pair.roi2 == hover_label2.label) color = hover_label2.color;
                    let c = new THREE.Color(color.r/256, color.g/256, color.b/256);

                    //massage it a bit
                    let hsl = {};
                    c.getHSL(hsl);
                    h = hsl.h*360;
                    s = hsl.s*100;
                    l = Math.max(hsl.l, 0.5)*100;
                    a = Math.max(a*3, 0.15);      
                }
            }
            return "hsla("+h+", "+s+"%, "+l+"%, "+a+")";
        },

        gettractcolor(pair, loffset) {
            //compute the average hue from roi1 and roi2 colors.
            let label1 = this.labels_o[pair.roi1];
            let label2 = this.labels_o[pair.roi2];
            let c1 = new THREE.Color(label1.color.r/256, label1.color.g/256, label1.color.b/256);
            let c2 = new THREE.Color(label2.color.r/256, label2.color.g/256, label2.color.b/256);
            let hsl1 = {};
            c1.getHSL(hsl1);
            let hsl2 = {};
            c2.getHSL(hsl2);
            let fin = new THREE.Color();
            return fin.setHSL((hsl1.h+hsl2.h)/2, 1, 0.8);    
        },

        getcolumncolor(column) {
            let label = this.labels_o[column];
            if(!label._mesh) return "gray"; 
            return new THREE.Color(label.color.r*2/256, label.color.g*2/256, label.color.b*2/256).getStyle();
        },

        showhide_roi(roi, vis) {
            let mesh = this.labels_o[roi]._mesh;
            if(mesh) mesh.visible = vis;
        },

        mouseover_pair(pair) {
            this.hovered_column = null; //mouseleave_column event doesn't fire sometimes
            this.hoverpair = pair;
            if(pair._mesh) pair._mesh.visible = true;
            this.showhide_roi(pair.roi1, true);
            this.showhide_roi(pair.roi2, true);
        },
        mouseleave_pair(pair) {
            if(this.hoverpair._mesh) {
                //restore opacity
                this.hoverpair._mesh.material.opacity = this.tract_opacity;
            }
            this.hoverpair = null;
            if(pair._mesh && !pair._selected) pair._mesh.visible = false;
            let selected = this.selected_rois();
            this.showhide_roi(pair.roi1, selected.has(pair.roi1));
            this.showhide_roi(pair.roi2, selected.has(pair.roi2));
        },
        mouseover_column(column) {
            let label = this.labels_o[column];
            this.hovered_column = column;
            if(label._mesh) label._mesh.visible = true;
        },

        mouseleave_column(column) {
            let label = this.labels_o[column];
            this.hovered_column = null;
            if(label._mesh) {
                let selected = this.selected_rois();
                if(!selected.has(label.label)) label._mesh.visible = false;
            }
        },     

        clickpair(pair) {
            let p = this.roi_pairs.indexOf(pair);
            this.roi_pairs[p]._selected = !pair._selected; 
            let selected = this.selected_rois();
            this.showhide_roi(pair.roi1, selected.has(pair.roi1)||this.hoverpair.roi1 == pair.roi1);
            this.showhide_roi(pair.roi2, selected.has(pair.roi2)||this.hoverpair.roi2 == pair.roi2);
            this.$forceUpdate();
        },

        find_roi_mesh(event) {
            let mouse = new THREE.Vector2();
            mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
            this.raycaster.setFromCamera( mouse, this.camera );
            let intersects = this.raycaster.intersectObjects(this.scene.children);

            //select first roi mesh
            for(let i = 0;i < intersects.length; ++i) {
                let obj = intersects[i].object;
                if(obj._roi) return obj;
            }
            return null;
        },
        
        mousedown(event) {
            let obj = this.find_roi_mesh(event);
            //this.hovered_column = null;
            if(obj) {
                let label = this.labels_o[obj._roi];
                this.pushed_roi = obj._roi;
            }
        },

        mouseup(event) {
            this.pushed_roi = null;
        },

        mousemove(event) {
            if(event.buttons) return; //ignore dragging events
            let obj = this.find_roi_mesh(event);
            if(obj) this.hovered_column = obj._roi;  
            else this.hovered_column = null;
        },

        selected_rois: function() {
            let rois = new Set();
            this.roi_pairs.forEach(pair=>{
                if(!pair._selected) return;
                rois.add(pair.roi1);
                rois.add(pair.roi2);
            });
            return rois;
        },

        is_hovered: function(column) {
            return (this.hoverpair && (this.hoverpair.roi1 == column || this.hoverpair.roi2 == column) || this.hovered_column == column)
        },

        compute_legendvalue(i) {
            //let mid_weight = (this.max_weight-this.min_weight)/2;
            //if(i == 0) return mid_weight.toFixed(3);
            let v = i.map(0, 100, this.min_weight, this.max_weight);
            /*
            // position will be between 0 and 100
            let minp = 0;
            let maxp = 100;

            // The result should be between min/max weight
            let minv = Math.log(this.min_weight); //min_weight needs to be non 0 for scaling to work correctly.
            let maxv = Math.log(this.max_weight);

            // calculate adjustment factor
            let scale = (maxp-minp)/(maxv-minv);
            let v = Math.exp(minv - scale*(i-minp));
            */
            if(this.max_weight < 1 && i != 0) return v.toFixed(3);
            return v.toFixed(0);
        },
    },

    template: `
    <div class="container" style="display:inline-block;">
         <div ref="stats" v-show="show_stats"/>
         <div id="conview" class="conview" ref="view" style="position:absolute; width: 100%; height:100%;" 
            @mousemove="mousemove" 
            @mousedown="mousedown"
            @mouseup="mouseup"></div>
         <div v-if="loading" class="loading">Loading .. <small>{{loading}}</small></div>
         <div class="status">
             <small v-if="hoverpair">{{hoverpair.weights}}</small><br>
             <b><a href="https://brainlife.io">brainlife.io</a></b><br>
             Network Neuro<br>
            <b>Brent McPherson</b>
         </div>

        <svg class="amatrix" v-if="roi_pairs"> 
            <g transform="rotate(-90 315 305)">
                <text v-for="(column, idx) in columns" :key="idx" 
                    :x="9*idx-2" :y="9*idx-2" text-anchor="start"
                    class="label" :class="{'label-selected':is_hovered(column)}"
                    :transform="'rotate(135 '+(9*idx)+' '+(9*idx)+')'" 
                    @mouseover="mouseover_column(column)"
                    @mouseleave="mouseleave_column(column)"
                    :fill="getcolumncolor(column)">{{labels_o[column].name}}</text>

                <rect v-for="pair in roi_pairs" class="roi"
                    :x="columns.indexOf(pair.roi2)*9" 
                    :y="columns.indexOf(pair.roi1)*9" 
                    :fill="getcolor(pair)"
                    width="8" height="8" 
                    @mouseover="mouseover_pair(pair)"
                    @mouseleave="mouseleave_pair(pair)"
                    @click="clickpair(pair)"/>
            </g>
        </svg>
        <svg class="legend" v-if="max_weight">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:1" />
                    <stop offset="100%" style="stop-color:rgb(255,255,255);stop-opacity:1" />
                </linearGradient>
            </defs>
            <!--<text x="45" y="15" fill="white" text-anchor="end">{{weight_field}}</text>-->
            <rect x="10" y="5" fill="url(#grad1)" width="250" height="10" />   
            <line x1="10" y1="17.5" x2="260" y2="17.5" style="stroke:rgba(255,255,255,0.3)" />
            <g v-for="i in [0, 20, 40, 60, 80, 100]">
                <text :x="10+(250/100*i)" y="28" class="number" :text-anchor="i==0?'start':'end'">{{compute_legendvalue(i)}}</text>
            </g>
        </svg>
    
    </div>            
    `
})
