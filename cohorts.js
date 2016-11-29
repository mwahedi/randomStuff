var cohortsCalc = {
    cohortInputSheet: null,
    cohortRetentionSheet: null,
    memory: null,
    headers: ["Cohorts"],
    tz: null,
    
    init: function(){
        /* 
           this is the "main" method, so to speak, we first clear the content of the sheet we need to write to,
           read in channels + calculate sessions + transactions for them, then read in devices + calculate sessions + transactions for those,
           then write the headers (in writeChannels), write the info from the read methods into the sheet.
        */
        
        var spreadsheet = SpreadsheetApp.getActive();
        this.cohortInputSheet = spreadsheet.getSheetByName("channelInputData");
        this.cohortRetentionSheet = spreadsheet.getSheetByName("Cohorts");
        this.tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
        
        //before each run of this script, delete the contents of the sheet first.
        this.cohortRetentionSheet.clearContents();
        
        this.readChannelCohorts();
        
        this.writeChannelHeaders();
        
        this.writeChannelCohorts();
        
    },
    
    readChannelCohorts: function() {
        var cohorts = {};
        var finCohort = {};
     
        var inputData = this.cohortInputSheet.getRange(2,1,this.cohortInputSheet.getLastRow()-1,14).getValues();
        var self = this;
        
        inputData.forEach(function(ele){
        
            //var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();

            var user = ele[0];
            var xWeek = parseInt(ele[9]);
            var dt = parseInt(ele[10]);
            if(!dt){return;}
            if(xWeek<0){return;}
            if(typeof cohorts[dt] != "object") {
                cohorts[dt] = {};
                cohorts[dt][user] = {};
                cohorts[dt][user][xWeek] = {delivered: 0,
                                      skipped: 0,
                                      cancelled: 0}
                var cancel = ele[8]
            }
            if(typeof cohorts[dt][user] != "object") {
                cohorts[dt][user] = {};
                cohorts[dt][user][xWeek] = {delivered: 0,
                                      skipped: 0,
                                      cancelled: 0}
                var cancel = ele[8]
            }
            if(typeof cohorts[dt][user][xWeek] != "object") {
                cohorts[dt][user][xWeek] = {delivered: 0,
                                      skipped: 0,
                                      cancelled: 0}
            }

            if((cancel>=ele[8])&&(ele[8]!=='')){
                cohorts[dt][user][ele[8]] = {delivered: 0,
                                             skipped: 0,
                                             cancelled: 1}
            }

            //redirect calculations for channels here
            if((ele[12]!=="") && (xWeek >= 0)) {
                if(ele[2]=="done") {
                    cohorts[dt][user][xWeek].delivered += 1;
                } else if((ele[2]=="skipped")||(ele[2]=="system_skipped")) {
                    cohorts[dt][user][xWeek].skipped += 1;
                } 
            }
        });
        
        for(var dt in cohorts) {
            for(var user in cohorts[dt]) {
                for(var wk in cohorts[dt][user]){
                    dt = parseInt(dt)
                    wk = parseInt(wk)
                    if(typeof finCohort[dt]!="object") {
                        finCohort[dt] = {};
                        finCohort[dt][wk] = {delivered: 0,
                                             skipped: 0,
                                             cancelled: 0}
                    }
                    if(typeof finCohort[dt][wk]!="object") {
                        finCohort[dt][wk] = {delivered: 0,
                                             skipped: 0,
                                             cancelled: 0}
                    }
                    //we have to make sure, that one user can have only one action each week.
                    //that means if they cancelled in the same week they got an order delivered
                    //the cancellation is then added to the following week
                    if((parseInt(cohorts[dt][user][wk].cancelled)>0)&&(
                       (parseInt(cohorts[dt][user][wk].delivered)>0)||(
                       (parseInt(cohorts[dt][user][wk].skipped)>0)))) {
                        finCohort[dt][wk].delivered += parseInt(cohorts[dt][user][wk].delivered);
                        finCohort[dt][wk].skipped += parseInt(cohorts[dt][user][wk].skipped);
                        if(typeof finCohort[dt][wk+1]!="object") {
                            finCohort[dt][wk+1] = {delivered: 0,
                                                   skipped: 0,
                                                   cancelled: 0}
                        }
                        finCohort[dt][wk+1].cancelled += parseInt(cohorts[dt][user][wk].cancelled)
                    } else {
                        finCohort[dt][wk].delivered += parseInt(cohorts[dt][user][wk].delivered)
                        finCohort[dt][wk].cancelled += parseInt(cohorts[dt][user][wk].cancelled)
                        finCohort[dt][wk].skipped += parseInt(cohorts[dt][user][wk].skipped)
                    }
                }
            }
        }

        for(var dt in finCohort) {
            var min = Math.min.apply(null,Object.keys(finCohort[dt]).map(Number));
            var max = Math.max.apply(null,Object.keys(finCohort[dt]).map(Number));
            for(var i=min+1; i<=max; i++) {
                finCohort[dt][i.toString()].cancelled += finCohort[dt][(i-1).toString()].cancelled
            }
        };
        
    this.memory = finCohort;

    },
    
    writeChannelHeaders: function() {
        //[[header1], [header2],...] this should be the format we go with
        var cohortAll = this.memory || {};
        
        var maxCohort = 0;
        for(var cohort in cohortAll){
            var vals = cohortAll[cohort];
            var amt = Object.keys(vals);
            if(amt.length > maxCohort.length || maxCohort == 0) { maxCohort = amt }
        }
        
        
        var weekVals = maxCohort.sort();
        var secondHeader = [];
        secondHeader.push('');
        secondHeader.push('');
        this.headers.push("size");
        for(d in weekVals){
            this.headers.push([d]);
            this.headers.push([d]);
            this.headers.push([d]);
            secondHeader.push('delivered');
            secondHeader.push('skipped');
            secondHeader.push('cancelled');
        };
        
        
        this.cohortRetentionSheet.getRange(1,1,1,this.headers.length).setValues([this.headers]);
        this.cohortRetentionSheet.getRange(2,1,1,secondHeader.length).setValues([secondHeader]);
    },
    
    writeChannelCohorts: function(){
        
        var deliveries = [];
        var size = this.headers.length
        var cohort = Object.keys(this.memory);
        cohort = cohort.sort()
        for(var j=0;j<cohort.length;j++) {
            if(this.memory[cohort[j]] !== "") {
                var ses = [cohort[j]]
                var row = this.memory[cohort[j]]
                var wks = Object.keys(this.memory[cohort[j]])
                wks = wks.map(Number);
                wks = wks.sort(function(a, b){return a-b})
                var fin = Math.max.apply(null,wks)
                for(var k = 0; k <= fin; k++) {
                    if(k==0) {
                        ses.push(row[wks[k]].delivered);
                        ses.push(row[wks[k]].delivered);
                        ses.push(row[wks[k]].skipped);
                        ses.push(row[wks[k]].cancelled);
                    } else {
                        ses.push(row[wks[k]].delivered);
                        ses.push(row[wks[k]].skipped);
                        ses.push(row[wks[k]].cancelled);
                    }
                }
                for(i=2;i<ses.length;i++) {
                        ses[i] = (ses[i]/ses[1])
                }
                if(ses.length!=size) {
                    var difference = size - ses.length;
                    for(i=0; i<difference;i++) {
                        ses.push('');
                    }
                }
    
                deliveries.push(ses);
            }
        }
        this.cohortRetentionSheet.getRange(3,1,deliveries.length,deliveries[0].length).setValues(deliveries);
    }
    
}


function retentionCalc() {
    
    cohortsCalc.init();
    
}
