Vue.component('amatrix',  {
    props: ["roi_pairs", "labels"],
    data() {
        return {
            columns: [], //list of roi (1001, 1002, etc..) in the order we want to display them in
            labels: {}, //to lookup label name from roi id

            hovered_roi1: null,
            hovered_roi2: null,
        }
    },

    template: `
        <div class="amatrix">
            <svg :width="columns.length*9+100"> 
                <g transform="rotate(45 50 100)">
                    <text v-for="(column, idx) in columns" :x="9*idx+10" :y="98" 
                        class="label" :class="{'label-selected':hovered_roi2 == column}" 
                        :transform="'rotate(-90 '+(9*idx+7)+' 98)'" :fill="getroicolor(column)">{{labels_o[column].name}}</text>
                    <text v-for="(column, idx) in columns" :x="columns.length*9+3" :y="9*idx+107" 
                        class="label" :class="{'label-selected':hovered_roi1 == column}" 
                        :fill="getroicolor(column)">{{labels_o[column].name}}</text>
                    <rect v-for="roi in roi_pairs"
                        class="roi"
                        :x="columns.indexOf(roi.roi2.toString())*9" 
                        :y="columns.indexOf(roi.roi1.toString())*9+100" 
                        width="8" height="8" 
                        :fill="getcolor(roi)"
                        @mouseover="mouseover(roi)"
                        @mouseleave="mouseleave(roi)"
                        @click="click(roi)"
                        />
                </g>
            </svg>
        </div>
    `,
    
    computed: {

        //create label look up object
        labels_o: function() {
            return this.labels.reduce((a,c)=>{
                a[c.label.toString()] = c;
                return a;
            }, {});
        },
    },

    mounted() {

        //find unique rois
        let columns = this.roi_pairs.reduce((a,c)=>{
            let label = this.labels_o[c.roi1.toString()];
            a.add(label.label);
            label = this.labels_o[c.roi2.toString()];
            a.add(label.label);
            return a;
        }, new Set());
        this.columns = [...columns].sort();   
        //console.log(this.columns);

        //find min/max value
        let min = null;
        let max = null;
        this.roi_pairs.forEach(roi=>{
            let v = roi.weights.count;
            if(v < min || min === null) min = v;
            if(v > max || max === null) max = v;
        });
        console.log("min", min);
        console.log("max", max);
    },

    methods: {
        getcolor(roi) {
            //console.log(roi.roi1.toString());
            //return roi.weights.count;
            //console.log(roi);
            let s = 0;
            if(roi._mesh) s = 20;          
            //let a = 0.3;
            if(roi._mesh && roi._mesh.visible) s = 100;
            //return "hsla(0, "+s+"%, "+(roi.weights.count*100)+"%, "+a+")";
            return "hsl(0, "+s+"%, "+Math.log(roi.weights.count)*20+"%)";
        },

        getroicolor(roi) {
            //if(this.hovered_roi1 == roi) return "red";
            let label = this.labels_o[roi];
            return "rgb("+label.color.r+","+label.color.g+","+label.color.b+")";
        },
        mouseover(roi) {
            if(roi._mesh) roi._mesh.visible = true;
            this.hovered_roi1 = roi.roi1;
            this.hovered_roi2 = roi.roi2;
            //console.log(JSON.stringify(roi.weights, null, 4), Math.log(roi.weights.count));
        },
        mouseleave(roi) {
            if(roi._mesh && !roi._selected) roi._mesh.visible = false;
            this.hovered_roi1 = null;
            this.hovered_roi2 = null;
        },
        click(roi) {
            roi._selected = !roi._selected;
        },
    }
})