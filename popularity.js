var arr = { 
    max: function(array) {
        return Math.max.apply(null, array);
    },
    
    min: function(array) {
        return Math.min.apply(null, array);
    },
    
    range: function(array) {
        return arr.max(array) - arr.min(array);
    },
    
    midrange: function(array) {
        return arr.range(array) / 2;
    },

    sum: function(array) {
        var num = 0;
        for (var i = 0, l = array.length; i < l; i++) num += array[i];
        return num;
    },
    
    mean: function(array) {
        return arr.sum(array) / array.length;
    },
    
    variance: function(array) {
        var mean = arr.mean(array);
        return arr.mean(array.map(function(num) {
            return Math.pow(num - mean, 2);
        }));
    },
    
    standardDeviation: function(array) {
        return Math.sqrt(arr.variance(array));
    },
    
    meanAbsoluteDeviation: function(array) {
        var mean = arr.mean(array);
        return arr.mean(array.map(function(num) {
            return Math.abs(num - mean);
        }));
    },
    
    zScores: function(array) {
        var mean = arr.mean(array);
        var standardDeviation = arr.standardDeviation(array);
        return array.map(function(num) {
            return (num - mean) / standardDeviation;
        });
    }
};

var calcPopularity = {
    sSheet: null,
    cSheet: null,
    oSheet: null,
    memory: null,
    orders: null,
    headers: ["Meal Name", "Total meals ordered", "Popularity", "Ordered when chef's choice",
              "Ordered when chef's choice (relative)", "Available as chef's choice",
              "Available as non chef's choice", "Ordered non chef's choice", "Ordered when not chef's choice (relative)",
              "Meals removed", "Meals added", "Meals removed (normalized)", "Meals added (normalized)",
              ],
    
    init: function(){
        /* 
           this is the "main" method, so to speak, we first clear the content of the sheet we need to write to,
           read in channels + calculate sessions + transactions for them, then read in devices + calculate sessions + transactions for those,
           then write the headers (in writeChannels), write the info from the read methods into the sheet.
        */
        
        var spreadsheet = SpreadsheetApp.getActive()
        this.sSheet = spreadsheet.getSheetByName("raw data")
        this.oSheet = spreadsheet.getSheetByName("orders")
        this.cSheet = spreadsheet.getSheetByName("overview")

        //before each run of this script, delete the contents of the sheet first.
        this.cSheet.clearContents();
        
        this.readAvail()
        this.readOrders()
        
        this.writeHeaders()
        
        this.writeAvail()
        
    },
    
    readAvail: function() {
        var avail = {};
        
        var inputData = this.sSheet.getRange(2,1,this.sSheet.getLastRow()-1,4).getValues();
        var self = this;
        
        inputData.forEach(function(ele){
        
            
            var xCohort = parseInt(ele[0]);

            if(typeof avail[xCohort] != "object"){
                avail[xCohort] = {no: 0, yes: 0, title: ""};
            }
            
            
            //redirect calculations for channels here
            if(ele[0]!==""){
                if(parseInt(ele[2])==0){
                    avail[xCohort].no = parseInt(ele[3]);
                } else {
                    avail[xCohort].yes = parseInt(ele[3]);
                }

                avail[xCohort].title = ele[1]
            }
        });

        this.memory = avail;
    },

    readOrders: function(){
        var orders = {};

        var orderData = this.oSheet.getRange(2,1,this.sSheet.getLastRow()-1,4).getValues();

        orderData.forEach(function(ele){

            var mealId = parseInt(ele[0]);

            if(typeof orders[mealId]!= "object"){
                orders[mealId] = {no: 0, yes: 0, title: ""};
            }

            if(ele[0]!==""){
                if(parseInt(ele[2])==0){
                    orders[mealId].no = parseInt(ele[3]);
                } else {
                    orders[mealId].yes = parseInt(ele[3]);
                }

                orders[mealId].title = ele[1];
            }


        });
        this.orders = orders;
    },
    
    writeHeaders: function(){
        //[[header1], [header2],...] this should be the format we go with        
        
        this.cSheet.getRange(3,1,1,this.headers.length).setValues([this.headers]);
    },
    
    writeAvail: function(){
        
        var rows = [];
        var size = this.headers.length
        var memAvail = this.memory
        var removed = [];
        var added = [];
        for (var order in this.orders){
            if(typeof memAvail[order] != "object"){ } else {
                removed.push( 1-(this.orders[order].yes/(memAvail[order].yes)));
                added.push( this.orders[order].no/memAvail[order].yes) ;
            }
        };

        var meanR = arr.mean(removed);
        var meanA = arr.mean(added);
        var sdR = arr.standardDeviation(removed);
        var sdA = arr.standardDeviation(added);
        var nR = removed.length;
        var aR = added.length;

        for (var d in this.orders) {
            if(d !== ""){
                var orders = this.orders[d];
                
                var ses = [];
                var a = memAvail[d]
                if(typeof memAvail[d] != "object"){continue}
                var mealR = 1-(orders.yes/memAvail[d].yes);
                if(memAvail[d].no==0) {
                    var mealA = 0
                } else { 
                    var mealA = orders.no/memAvail[d].no;
                }
                ses.push(orders.title);
                ses.push(orders.no + orders.yes);
                ses.push( ((meanR-mealR)/(sdR*Math.sqrt(nR))) + 
                          ((mealA-meanA)/(sdA*Math.sqrt(aR))) );
                ses.push(orders.yes);
                ses.push(orders.yes/(memAvail[d].yes)); 
                ses.push(memAvail[d].yes);
                ses.push(memAvail[d].no);
                ses.push(orders.no);
                ses.push(orders.no/memAvail[d].yes);
                
                ses.push(mealR);
                if(orders.no == 0){
                   ses.push(meanA)
                } else {
                   ses.push(mealA);
                }
                
                ses.push( (mealR - meanR)/(sdR*Math.sqrt(nR)) );
                if(orders.no == 0){
                    ses.push(0)
                } else {
                    ses.push( (mealA-meanA)/(sdA*Math.sqrt(aR)) );
                }
                
                ses[2] = ses[11] + ses[12]
                rows.push(ses);
            }
        }
        this.cSheet.getRange(4,1,rows.length,rows[0].length).setValues(rows);
    },
    
}


function popularityCalc() {
    
    calcPopularity.init();
    
}
