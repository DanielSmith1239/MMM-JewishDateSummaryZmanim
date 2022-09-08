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
        if (ret.includes("Erev")) { ret = ret.replace("Erev ", "") + " I"; }
        else if (ret.endsWith(" I")) { ret = ret.replace(" I", " II"); }
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
            } else if (date == "Friday") {
                date = "Shabbos " + dateStr;
            }
            
            if (candleLightingDate == null && isCandleLighting) {
                if (item["memo"] != null) {
                    const today = new Date();
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
                    const today = new Date();
                    const dateStr = (today.getMonth() + 1)+ "/" + today.getDate();
                    isToday = candleLightingDates.includes(dateStr);
                }
                
                dateEl = document.createElement("div");
                dateEl.className = "small";
                if (isToday) { dateEl.className = dateEl.className + " bright"; }
                dateEl.innerHTML = day;
                                
                wrapper.appendChild(dateEl);

                for (var e in dayEvents) {
                    eventEl = document.createElement("div");
                    eventEl.className = "medium";
                    if (isToday) { eventEl.className = eventEl.className + " bright"; }
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
        var url = "https://www.hebcal.com/hebcal?v=1&cfg=json&b=" + c.minutesBefore + "&a=" + ashkenaz + "maj=on&min=on&mod=on&nx=on&year=now&month=x&ss=on&mf=on&c=on" + "&geo=pos&latitude=" + c.latitude + "&longitude=" + c.longitude + "&tzid=" + c.tzid;
        return url
    },
    
    isAfterDate: function(date, isAfter) {
      return date.getFullYear() >= isAfter.getFullYear() &&
        date.getMonth() >= isAfter.getMonth() &&
        date.getDate() >= isAfter.getDate();
    },
    
    isAfterToday: function(date) {
      const today = new Date();
      return this.isAfterDate(date, today)
    },
    
    isToday: function(date) {
      const today = new Date();
      return date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();
    },
    
    filterResults: function(items) {
        // TODO:
        // - Check if havdalah is before candle lighting beginning of year
        // - Check if missing havdallah end of year
        const today = new Date();
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        var yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const itemsAfterNow = items.filter(item => this.isAfterToday(moment(item["date"]).toDate()));
        
        const candleLightingItemsAfterNow = itemsAfterNow.filter(item => item["category"] === "candles");
        const havdallahItemsAfterNow = itemsAfterNow.filter(item => item["category"] === "havdalah");
        const fastStartAfterNow = itemsAfterNow.filter(item => item["title"] === "Fast begins");
        const fastEndAfterNow = itemsAfterNow.filter(item => item["title"] === "Fast ends");
        
        const firstCandleLightingDate = moment(candleLightingItemsAfterNow[0]["date"]).toDate();
        const firstHavdallahDate = moment(havdallahItemsAfterNow[0]["date"]).toDate();
        const firstFastStartDate = moment(fastStartAfterNow[0]["date"]).toDate();
        const firstFastEndDate = moment(fastEndAfterNow[0]["date"]).toDate();
        
        var filtered = [];
        
        if (this.isAfterDate(firstHavdallahDate, firstCandleLightingDate) && this.isAfterDate(firstFastEndDate, firstFastStartDate)) {
            filtered = itemsAfterNow;
        } else {
            const itemsAfterMostRecentCandleLighting = items.filter(item => this.isAfterDate(moment(item["date"]).toDate(), firstCandleLightingDate));
            filtered = itemsAfterMostRecentCandleLighting;
        }
        
        const candleLightings = filtered.filter(item => item["category"] == "candles"
                                               && this.isAfterDate(firstHavdallahDate, moment(item["date"]).toDate()));  
        
        const fastItems = filtered.filter(item => item["title"].includes("Fast begins")
                                               && this.isAfterDate(moment(item["date"]).toDate(), yesterday)
                                               && this.isAfterDate(tomorrow, moment(item["date"]).toDate())
                                               && this.isAfterDate(firstFastEndDate, moment(item["date"]).toDate())
                                                                );
        
        const todayItems = itemsAfterNow.filter(item => this.isToday(moment(item["date"]).toDate()));
        
        
        
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
