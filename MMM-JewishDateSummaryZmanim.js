/* Magic Mirror
 * Module: Pi-Hole Stats
 *
 * By Sheya Bernstein https://github.com/sheyabernstein/MMM-shabbat
 * MIT Licensed.
 */

Module.register("MMM-JewishDateSummaryZmanim", {

    // Default module config.
    defaults: {
        minutesBefore: "18",
        minutesAfter: "50",
        ashkenaz: true,

        latitude: "",
        longitude: "",
        tzid: "",

        updateInterval:  30 * 60 * 1000, // every thirty minutes
        animationSpeed: 1000,

        retryDelay: 2500,
        initialLoadDelay: 0,

        modulesHidden: false, // don't change
    },

    // Define required scripts.
    getScrips: function() {
        return ["moment.min.js"];
    },

    // Define start sequence.
    start: function() {
        //this.today = new Date();
        this.today = new Date("2022-09-26T20:04:00-04:00");
        
        Log.info("Starting module: " + this.name);

        this.items = [];
        this.loaded = false;
        this.scheduleUpdate(this.config.initialLoadDelay);
    },
    
    processMemo: function(memo) {
        var ret = memo;
        
        // Rosh Hashana
        if (ret.includes("Rosh Hashana 5")) { return "Rosh Hashana"; }
        
        // Chol hamoed
        if (ret.includes(" (CH''M)")) { ret = ret.replace(" (CH''M)", ""); }
        
        // Remove "Erev"; increment roman numerals
        if (ret.includes("Erev")) { ret = ret.replace("Erev ", "") + ""; }
        else if (ret.endsWith(" I")) { ret = ret.replace(" I", ""); }
        else if (ret.endsWith(" VII")) { ret = ret.replace(" VII", " VIII"); }

        return ret;
    },

    // Override dom generator.
    getDom: function() {
        var wrapper = document.createElement("div");

        var requiredConfigs = ["latitude", "longitude", "tzid"]

        for (var i in requiredConfigs) {
        	req = requiredConfigs[i]
        	if (this.config[req] === "") {
        		wrapper.innerHTML = "Please set the correct <i>" + req + "</i> in the config for module " + this.name + ".";
            	wrapper.className = "dimmed light small";
            	return wrapper;
        	}
        }

        if (!this.loaded) {
            wrapper.innerHTML = this.translate("LOADING");
            wrapper.className = "dimmed light";
            return wrapper;
        }

        var events = {};
        
        this.items = this.filterResults(this.items);
        
        var candleLightingDate = null;
        var candleLightingDates = [];

        for (var i in this.items) {
            var item = this.items[i];
            var date = moment(item["date"]).calendar().split(" at")[0];
            var title = item["title"]
                .replace("Candle lighting: ", "🕯️  ");
            
            if (title.includes('Havdalah')) {
                title = "✨  " + title.split(": ")[1];
            }
            
            const isCandleLighting = title.includes("🕯️");
            const isHavdallah = title.includes("✨");
            
            const actualDate = moment(item["date"]).toDate();
            const dateStr = (actualDate.getMonth() + 1) + "/" + actualDate.getDate();
            
            if (candleLightingDate != null && (isCandleLighting || isHavdallah)) {
                candleLightingDates.push(dateStr);
                date = candleLightingDate;
            } else if (actualDate.getDay() === 5) {
                date = "Shabbos " + dateStr;
            }
            
            if (candleLightingDate == null && isCandleLighting) {
                if (item["memo"] != null) {
                    const today = this.today;
                    const isToday = today.getDate() === actualDate.getDate();
                    date = this.processMemo(item["memo"]);
                    if (!isToday) { date = date + " (" + dateStr + ")"; }
                }
                candleLightingDates.push(dateStr);
                candleLightingDate = date;
            }

            if(events.hasOwnProperty(date)) {
                events[date].push(title);
            }
            else {
                events[date] = [title];
            }
        }

        eventKeys = Object.keys(events).slice(0, 3);

        for (var i in eventKeys) {
            var day = eventKeys[i];
            var dayEvents = events[eventKeys[i]];

            if (dayEvents) {
                var isToday = false;
                if (day.includes("/")) {
                    const today = this.today;
                    const dateStr = (today.getMonth() + 1)+ "/" + today.getDate();
                    isToday = candleLightingDates.includes(dateStr);
                }
                
                dateEl = document.createElement("div");
                dateEl.className = "small";
                if (isToday) { dateEl.className = dateEl.className + " bright"; }
                dateEl.innerHTML = day;
                                
                wrapper.appendChild(dateEl);
                
                var processedCandleLighting = false;
                var isMinorCandleLighting = false;

                for (var e in dayEvents) {
                    var eventEl = document.createElement("div");
                    eventEl.className = "medium";
                    
                    if (dayEvents[e].includes("✨") || dayEvents[e].includes("🕯️")) {
                        eventEl.style = "display: inline;";
                    }
                    
                    if (dayEvents[e].includes("🕯️")) {
                        if (processedCandleLighting) {
                            isMinorCandleLighting = true;
                            dayEvents[e] = dayEvents[e].replace("🕯️  ", "🕯️2️⃣  ");
                        } else {
                            eventEl.style = "display: inline; padding-right: 50px;";
                        }
                        
                        processedCandleLighting = true;
                    }
                    
                      
                    if (dayEvents[e].includes("✨") && candleLightingDates.length >= 3) {
                        eventEl.style = "";
                    }
                    
                    if (isToday && !isMinorCandleLighting) { eventEl.className = eventEl.className + " bright"; }
                    isMinorCandleLighting = false;
                    eventEl.innerHTML = dayEvents[e];
//                     eventEl.style["text-indent"] = "1em";
                    wrapper.appendChild(eventEl);
                }
            }
        }

        return wrapper;
    },

    updateTimes: function() {
        var self = this;
        var url = self.makeURL();
        var retry = true;

        var timesRequest = new XMLHttpRequest();
        timesRequest.open("GET", url, true);
        timesRequest.onreadystatechange = function() {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    self.processTimes(JSON.parse(this.response));
                } else {
                    Log.error(self.name + ": Could not load shabbat updateTimes.");
                }

                if (retry) {
                    self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
                }
            }
        };
        timesRequest.send();
    },

    scheduleUpdate: function(delay) {
        var nextLoad = this.config.updateInterval;
        if (typeof delay !== "undefined" && delay >= 0) {
            nextLoad = delay;
        }

        var self = this
        setTimeout(function() {
            self.updateTimes();
        }, nextLoad);
    },

    makeURL: function() {
        var c = this.config

        var ashkenaz = "on"
        if (!c.ashkenaz) {
            ashkenaz = "off"
        }

//         var url = "https://www.hebcal.com/shabbat/?cfg=json&b=" + c.minutesBefore + "&m=" + c.minutesAfter + "&a=" + ashkenaz + "&geo=pos&latitude=" + c.latitude + "&longitude=" + c.longitude + "&tzid=" + c.tzid;
        var url = "https://www.hebcal.com/hebcal?v=1&cfg=json&b=" + c.minutesBefore 
            + "&a=" + ashkenaz + "maj=on&min=on&mod=on&nx=on&year=now&month=x&ss=on&mf=on&c=on"
            + "&o=on&nx=on&s=on&leyning=off"
            + "&geo=pos&latitude=" + c.latitude + "&longitude=" + c.longitude + "&tzid=" + c.tzid;
        return url
    },
    
    isAfterDate: function(date, isAfter) {
        const a = new Date(date.getTime());
        const b = new Date(isAfter.getTime());
        a.setHours(0, 0, 0);
        b.setHours(0, 0, 0);
      return a.getTime() >= b.getTime();
    },
    
    isAfterToday: function(date) {
      const today = this.today;
      return this.isAfterDate(date, today)
    },
    
    isToday: function(date) {
        const a = new Date(this.today.getTime());
        const b = new Date(date.getTime());
        a.setHours(0, 0, 0);
        b.setHours(0, 0, 0);
        return a.getTime() === b.getTime();
    },
    
    filterResults: function(items) {
        // TODO:
        // - Check if havdalah is before candle lighting beginning of year
        // - Check if missing havdallah end of year
        const today = this.today;
        var tomorrow = this.today;
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        var yesterday = this.today;
        yesterday.setDate(yesterday.getDate() - 1);
        
        const itemsAfterNow = items.filter(item => this.isAfterToday(moment(item["date"]).toDate()));
        const itemsBeforeNow = items.filter(item => !this.isAfterToday(new Date(item["date"])));
        
//         const candleLightingItemsAfterNow = itemsAfterNow.filter(item => item["category"] === "candles");
        const havdallahItemsAfterNow = itemsAfterNow.filter(item => item["category"] === "havdalah");
        const havdallahItemsBeforeNow = itemsBeforeNow.filter(item => item["category"] === "havdalah");
        
        const nextHavdallahDate = new Date(havdallahItemsAfterNow[0]["date"]);
        const prevHavdallahDate = new Date(havdallahItemsBeforeNow[havdallahItemsBeforeNow.length - 1]["date"]);
        const candleLightings = items.filter(item => {
            if (item["category"] !== "candles") { return false; }
            
            const itemDate = new Date(item["date"]);
            
            if (this.isAfterDate(itemDate, prevHavdallahDate)) {
                console.log("after");
            }
            
            return this.isAfterDate(itemDate, prevHavdallahDate)
                && this.isAfterDate(nextHavdallahDate, itemDate);
        });
        

//         const fastStartAfterNow = itemsAfterNow.filter(item => item["title"] === "Fast begins");
//         const fastEndAfterNow = itemsAfterNow.filter(item => item["title"] === "Fast ends");
        
//         const firstCandleLightingDate = moment(candleLightingItemsAfterNow[0]["date"]).toDate();
//         const firstFastStartDate = moment(fastStartAfterNow[0]["date"]).toDate();
//         const firstFastEndDate = moment(fastEndAfterNow[0]["date"]).toDate();
        
//         var filtered = [];
        
        
        
//         // Normal
//         if (this.isAfterDate(firstHavdallahDate, firstCandleLightingDate) && this.isAfterDate(firstFastEndDate, firstFastStartDate)) {
//             console.log("normal");
//             filtered = itemsAfterNow;
//         } 
//         // Between candle lighting and havdallah
//         else {
//             console.log("between dates");
//             const prevCandleLightingDates = items.filter(item => item["category"] === "candles"
//                                                        && this.isAfterDate(firstCandleLightingDate, new Date(item["date"])));
//             const prevCandleLighting = prevCandleLightingDates[prevCandleLightingDates.length - 1];
//             const prevCandleLightingDate = new Date(prevCandleLighting["date"]);
//             const itemsAfterMostRecentCandleLighting = items.filter(item => this.isAfterDate(moment(item["date"]).toDate(), prevCandleLightingDate));
//             filtered = itemsAfterMostRecentCandleLighting;
//         }
        
//         const candleLightings = filtered.filter(item => item["category"] === "candles"
//                                                && this.isAfterDate(firstHavdallahDate, moment(item["date"]).toDate()));  
        
//         const fastItems = filtered.filter(item => item["title"].includes("Fast begins")
//                                                && this.isAfterDate(moment(item["date"]).toDate(), yesterday)
//                                                && this.isAfterDate(tomorrow, moment(item["date"]).toDate())
//                                                && this.isAfterDate(firstFastEndDate, moment(item["date"]).toDate())
//                                                                 );
        
        const todayItems = itemsAfterNow.filter(item => this.isToday(moment(item["date"]).toDate())
                                                    && item["category"] != "candles"
                                                    && item["category"] != "havdalah"
                                               );
        
        
        
//         return [...todayItems, ...fastItems, ...candleLightings, havdallahItemsAfterNow[0]];
        return [...todayItems, ...candleLightings, havdallahItemsAfterNow[0]];
        
    },

    processTimes: function(data) {
        if (!data || !data['items']) {
            // Did not receive usable new data.
            return;
        }

        this.items = data['items']
        this.loaded = true;
        this.updateDom(this.config.animationSpeed);
    }
})
