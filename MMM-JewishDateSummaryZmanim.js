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
                .replace("Candle lighting: ", "🕯️  ")
                .replace("Havdalah: ", "✨  ");
            
            const isCandleLighting = title.includes("🕯️");
            const isHavdallah = title.includes("✨");
            
            const actualDate = moment(item["date"]).toDate();
            const dateStr = actualDate.getMonth() + "/" + actualDate.getDate();
            
            if (candleLightingDate != null && (isCandleLighting || isHavdallah)) {
                candleLightingDates.push(dateStr);
                date = candleLightingDate;
            } else if (date == "Friday") {
                date = "Shabbos " + dateStr;
            } else if (date === "Saturday") {
                date = "Shabbos";
            }
            
            if (candleLightingDate == null && isCandleLighting) {
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
                    const dateStr = today.getMonth() + "/" + today.getDate();
                    isToday = candleLightingDates.includes(dateStr);
                }
                
                dateEl = document.createElement("div");
                dateEl.className = "small";
                if (isToday) { dateEl.className = dateEl.className + " bright"; }
                dateEl.innerHTML = day;
                                
                wrapper.appendChild(dateEl);

                for (var e in dayEvents) {
                    eventEl = document.createElement("div");
                    eventEl.className = "medium bright";
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
        var url = 'https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=on&nx=on&year=now&month=x&ss=on&mf=on&c=on&geo=pos&latitude=42.480202&M=on&longitude=-83.240997'
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
        
        const itemsAfterNow = items.filter(item => this.isAfterToday(moment(item["date"]).toDate()));
        const candleLightingItemsAfterNow = itemsAfterNow.filter(item => item["category"] === "candles");
        const havdallahItemsAfterNow = itemsAfterNow.filter(item => item["category"] === "havdalah");
        
        const lastCandleLightingDate = moment(candleLightingItemsAfterNow[0]["date"]).toDate();
        const lastHavdallahDate = moment(havdallahItemsAfterNow[0]["date"]).toDate();
        var filtered = [];
        
        if (this.isAfterDate(lastHavdallahDate, lastCandleLightingDate)) {
            filtered = itemsAfterNow;
        } else {
            const itemsAfterMostRecentCandleLighting = items.filter(item => this.isAfterDate(moment(item["date"]).toDate(), lastCandleLightingDate));
            filtered = itemsAfterMostRecentCandleLighting;
        }
        
        const candleLightings = filtered.filter(item => item["category"] == "candles"
                                               && this.isAfterDate(lastHavdallahDate, moment(item["date"]).toDate()));
        
        console.log("size: " + candleLightings.length);
        
        // Get final items
        const todayItems = itemsAfterNow.filter(item => this.isToday(moment(item["date"]).toDate()));
        
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
