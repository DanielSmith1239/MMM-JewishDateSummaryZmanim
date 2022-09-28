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
        this.today = new Date();
//         this.today = new Date("2022-09-29T20:04:00-04:00");
        
        Log.info("Starting module: " + this.name);

        this.items = [];
        this.loaded = false;
        this.scheduleUpdate(this.config.initialLoadDelay);
    },
    
    processMemo: function(memo) {
        var ret = memo;
        
        // Rosh Hashana
        
        // Chol hamoed
        if (ret.includes(" (CH''M)")) { ret = ret.replace(" (CH''M)", ""); }
        
        // Remove "Erev"; increment roman numerals
        if (ret.includes("Erev")) { ret = ret.replace("Erev ", ""); }
        else if (ret.includes("(observed)")) { ret = ret.replace(" (observed)", ""); }
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
        
        var fastDate = null;
        var candleLightingDate = null;
        var candleLightingDates = [];
        
        var dateTitles = [];
        var dateItems = [];
        
        var items = [];
        var titles = [];

        for (var i in this.items) {
            var item = this.items[i];
            var date = moment(item["date"]).calendar().split(" at")[0];
            var title = item["title"]
                .replace("Candle lighting: ", "🕯️  ");
            
            if (title.includes('Havdalah')) {
                title = "✨  " + title.split(": ")[1];
            }
            
            var isFastDay = false;
            if (title.includes("Fast ")) {
                isFastDay = true;
                
                var timeStr = (new Date(item["date"])).toLocaleString()
                    .split(", ")[1];
                const timeComponents = timeStr.split(" ");
                const clockComponents = timeComponents[0].split(":");
                const amPm = timeComponents[1].toLowerCase();
                
                const timeTitle = clockComponents[0] + ":" + clockComponents[1] + amPm;
                
//                 if (title === "Fast ends") {
// //                     title = "🍽️  " + timeTitle;
//                     title = "PLATE  " + timeTitle;
//                 } else if (title === "Fast begins") {
// //                     title = "🛑  " + timeTitle;
//                     title = "STOP  " + timeTitle;
//                 }
            }
            

            const isCandleLighting = title.includes("🕯️");
            const isHavdallah = title.includes("✨");
            
            const actualDate = new Date(item["date"]);
            const dateStr = (actualDate.getMonth() + 1) + "/" + actualDate.getDate();
            
            if (candleLightingDate != null && (isCandleLighting || isHavdallah)) {
                candleLightingDates.push(dateStr);
                date = candleLightingDate;
            } else if (actualDate.getDay() === 5) {
                date = "Shabbos " + dateStr;
            }
            
            if (isFastDay) {
                if (fastDate == null) {
                    const tmroStr = (this.today.getDate() !== actualDate.getDate())
                        ? "Tomorrow: " : "";
                    fastDate = tmroStr + this.processMemo(item["memo"]);
                }
                
                date = fastDate;
            }
            
            
            if (candleLightingDate == null && isCandleLighting) {
                if (item["memo"] != null) {
                    if (item["memo"].includes("Parash")) {
                        date += ": " + item["memo"];
                    } else {
                        const today = this.today;
                        date = this.processMemo(item["memo"]);
                        const includesToday = this.items.some(item => this.isToday(actualDate));
                        if (!includesToday) { date = date + " (" + dateStr + ")"; }
                    }
                }
                
                candleLightingDates.push(dateStr);
                candleLightingDate = date;
            }

            if (events.hasOwnProperty(date)) {
                events[date].push(title);
            }
            else {
                events[date] = [title];
            }
            
            if (!dateTitles.includes(date)) {
                dateTitles.push(date);
                dateItems.push([actualDate]);
            } else {
                dateItems[dateItems.length - 1].push(actualDate);
            }
            
            items.push(item);
            titles.push(title);
        }

        const eventKeys = Object.keys(events).slice(0, 3);

        for (var i in eventKeys) {
            var day = eventKeys[i];
            var dayEvents = events[eventKeys[i]];
            
            const eventDates = dateItems[dateTitles.indexOf(eventKeys[i])];

            if (dayEvents) {
                var isToday = false;
                
                var dateEl = document.createElement("div");
                dateEl.className = "small";
                
                if (eventDates.some(date => date.getDate() === this.today.getDate())) {
                    dateEl.className += " bright";
                }
                
                
                dateEl.innerHTML = day;
                dateEl.style = "padding-bottom: 5px;";
                if (i > 0) {
                    dateEl.style = "padding-bottom: 5px; padding-top: 15px;";
                }
                wrapper.appendChild(dateEl);
                
                var processedCandleLighting = false;
                var isMinorCandleLighting = false;

                for (var e in dayEvents) {
                    var eventEl = document.createElement("div");
                    eventEl.className = "medium";
                    
                    const item = items[titles.indexOf(dayEvents[e])];

                    isToday = (new Date(item["date"])).getDate() === this.today.getDate();
                    
                    if (dayEvents[e].includes("✨") 
                            || dayEvents[e].includes("🕯️")
                            || dayEvents[e].includes("🛑")
                            || dayEvents[e].includes("🍽️")) {
                        eventEl.style = "display: inline;";
                    }
                    
                    if (dayEvents[e].includes("🛑")) {
                        eventEl.style = "display: inline; padding-right: 50px;";
                    }
                    
                    if (dayEvents[e].includes("🕯️")) {
                        if (!processedCandleLighting) {
                            eventEl.style = "display: inline; padding-right: 50px;";
                        }
                        
                        processedCandleLighting = true;
                    }
                    
                      
                    if (dayEvents[e].includes("✨") && candleLightingDates.length >= 3) {
                        eventEl.style = "";
                    }
                    
                    if (isToday) {
                        eventEl.className = eventEl.className + " bright";
                    }
                    
                    eventEl.innerHTML = dayEvents[e];
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
        this.today = new Date();

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
        if (a.getDate() === 27) {
        console.log("27");
        }
        a.setHours(0, 0, 0, 0);
        b.setHours(0, 0, 0, 0);
      
      return a.getTime() >= b.getTime();
    },
    
    isAfterToday: function(date) {
      const today = this.today;
      return this.isAfterDate(date, today)
    },
    
    isToday: function(date) {
        const a = new Date(this.today.getTime());
        const b = new Date(date.getTime());
        a.setHours(0, 0, 0, 0);
        b.setHours(0, 0, 0, 0);
        return a.getTime() === b.getTime();
    },
    
    filterResults: function(items) {
        // TODO:
        // - Check if havdalah is before candle lighting beginning of year
        // - Check if missing havdallah end of year
        const today = this.today;
        
        // Candle lighting and Havdallah
        const itemsAfterNow = items.filter(item => this.isAfterToday(moment(item["date"]).toDate()));
        const itemsBeforeNow = items.filter(item => !this.isAfterToday(new Date(item["date"])));
        
        const havdallahItemsAfterNow = itemsAfterNow.filter(item => item["category"] === "havdalah");
        const havdallahItemsBeforeNow = itemsBeforeNow.filter(item => item["category"] === "havdalah");
        
        const nextHavdallahDate = new Date(havdallahItemsAfterNow[0]["date"]);
        const prevHavdallahDate = new Date(havdallahItemsBeforeNow[havdallahItemsBeforeNow.length - 1]["date"]);
        const candleLightings = items.filter(item => {
            if (item["category"] !== "candles") { return false; }
            
            const itemDate = new Date(item["date"]);
            
            return this.isAfterDate(itemDate, prevHavdallahDate)
                && this.isAfterDate(nextHavdallahDate, itemDate);
        });
        
        
        // Fast days
        var fastItems = []
        const nextFastEndItems = itemsAfterNow.filter(item => item["title"] === "Fast ends");
        if (nextFastEndItems.length > 0) {
            const nextFastEnd = nextFastEndItems[0];

            const nextFastEndDate = new Date(nextFastEnd["date"]);
            const fastStartBeforeItems = items.filter(item => item["title"] === "Fast begins" 
                                           && this.isAfterDate(nextFastEndDate, (new Date(item["date"]))));
            const fastStart = fastStartBeforeItems[fastStartBeforeItems.length - 1];
            const fastStartDate = new Date(fastStart["date"]);
            // Show fast day if:
            // 1. In middle (current day has "Fast start" or "Fast end" items, or in between)
            // 2. Tomorrow has "Fast start" item
            var tomorrow = new Date(this.today.getTime());
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            var startOnlyDate = new Date(fastStartDate.getTime());
            startOnlyDate.setHours(0, 0, 0, 0);
            const fastStartsTomorrow = startOnlyDate.getTime() === tomorrow.getTime();

            const shouldShowFastDay = fastStartsTomorrow || (
                this.isAfterDate(this.today, fastStartDate) && this.isAfterToday(nextFastEndDate));
            
            if (shouldShowFastDay) {
                fastItems = [fastStart, nextFastEnd];
            }
        }
    
        
        
        const todayItems = itemsAfterNow.filter(item => this.isToday(moment(item["date"]).toDate())
                                                    && item["category"] != "candles"
                                                    && item["category"] != "havdalah"
                                                    && item["subcat"] != "fast"
                                               );
        
        
       return [...todayItems, ...fastItems, ...candleLightings, havdallahItemsAfterNow[0]];
        
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
