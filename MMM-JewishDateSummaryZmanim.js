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
    getScripts: function() {
        return ["moment.min.js"];
    },

    getScrips: function() {
        return this.getScripts();
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

    sortItemsByDate: function(items) {
        return items.slice().sort((a, b) => new Date(a["date"]) - new Date(b["date"]));
    },

    getDateLabel: function(date) {
        return (date.getMonth() + 1) + "/" + date.getDate();
    },

    isBoundaryItem: function(item) {
        return item["category"] === "candles" || item["title"].includes("Havdalah:");
    },

    formatDisplayItem: function(item) {
        var title = item["title"]
            .replace("Candle lighting: ", "🕯️  ");

        if (title.includes("Havdalah")) {
            title = "✨  " + title.split(": ")[1];
        }

        var isFastDay = false;
        if (title.includes("Fast ")) {
            isFastDay = true;

            var timeStr = (new Date(item["date"])).toLocaleTimeString("en-US");
            const timeComponents = timeStr.split(" ");
            const clockComponents = timeComponents[0].split(":");
            const amPm = timeComponents[1].toLowerCase();
            const timeTitle = clockComponents[0] + ":" + clockComponents[1] + amPm;

            if (title === "Fast ends") {
                title = "🍽️  " + timeTitle;
            } else if (title === "Fast begins") {
                title = "🛑  " + timeTitle;
            }
        }

        return {
            title: title,
            isFastDay: isFastDay,
            isCandleLighting: title.includes("🕯️"),
            isHavdallah: title.includes("✨")
        };
    },

    getBoundaryGroupLabel: function(items, itemsIncludeToday) {
        const firstItem = items[0];
        const firstDate = new Date(firstItem["date"]);
        const dateStr = this.getDateLabel(firstDate);
        const memos = [];

        items.forEach(item => {
            if (!item["memo"]) { return; }

            const memo = this.processMemo(item["memo"]);
            if (memo !== "" && !memos.includes(memo)) {
                memos.push(memo);
            }
        });

        if (memos.length === 1 && memos[0].includes("Parash")) {
            return "Shabbos " + dateStr + ": " + memos[0];
        }

        if (memos.length > 0) {
            var label = memos.join(" / ");
            if (!itemsIncludeToday) {
                label += " (" + dateStr + ")";
            }
            return label;
        }

        if (firstDate.getDay() === 5) {
            return "Shabbos " + dateStr;
        }

        return moment(firstItem["date"]).calendar().split(" at")[0];
    },

    buildDisplayGroups: function(items) {
        const sortedItems = this.sortItemsByDate(items);
        const itemsIncludeToday = sortedItems.some(item => this.isToday(new Date(item["date"])));
        const groups = [];
        var fastLabel = null;
        var activeBoundaryGroup = null;
        var previousBoundaryDay = null;

        for (var i = 0; i < sortedItems.length; i++) {
            const item = sortedItems[i];
            const actualDate = new Date(item["date"]);
            const dateStr = this.getDateLabel(actualDate);
            const display = this.formatDisplayItem(item);
            const boundaryDay = new Date(actualDate.getFullYear(), actualDate.getMonth(), actualDate.getDate()).getTime();
            var group = null;

            if (display.isFastDay) {
                if (fastLabel == null) {
                    const tmroStr = (!this.isToday(actualDate)) ? "Tomorrow: " : "";
                    fastLabel = tmroStr + this.processMemo(item["memo"]);
                }

                activeBoundaryGroup = null;
                previousBoundaryDay = null;
                group = groups[groups.length - 1];
                if (!group || group.type !== "fast" || group.label !== fastLabel) {
                    group = { label: fastLabel, entries: [], type: "fast" };
                    groups.push(group);
                }
            } else if (display.isCandleLighting || display.isHavdallah) {
                const startsNewBoundaryGroup = activeBoundaryGroup == null
                    || previousBoundaryDay == null
                    || (boundaryDay - previousBoundaryDay) > 24 * 60 * 60 * 1000;

                if (startsNewBoundaryGroup) {
                    activeBoundaryGroup = { label: "", entries: [], type: "boundary", boundaryItems: [] };
                    groups.push(activeBoundaryGroup);
                }

                activeBoundaryGroup.boundaryItems.push(item);
                activeBoundaryGroup.label = this.getBoundaryGroupLabel(activeBoundaryGroup.boundaryItems, itemsIncludeToday);
                previousBoundaryDay = boundaryDay;
                group = activeBoundaryGroup;
            } else {
                activeBoundaryGroup = null;
                previousBoundaryDay = null;

                var label = moment(item["date"]).calendar().split(" at")[0];
                if (actualDate.getDay() === 5) {
                    label = "Shabbos " + dateStr;
                }

                group = groups[groups.length - 1];
                if (!group || group.type !== "default" || group.label !== label) {
                    group = { label: label, entries: [], type: "default" };
                    groups.push(group);
                }
            }

            group.entries.push({
                item: item,
                title: display.title,
                actualDate: actualDate,
                isToday: this.isToday(actualDate)
            });
        }

        return groups.slice(0, 3);
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

        const groups = this.buildDisplayGroups(this.filterResults(this.items));

        for (var i in groups) {
            var group = groups[i];

            if (group.entries.length > 0) {
                var dateEl = document.createElement("div");
                dateEl.className = "small";

                if (group.entries.some(entry => entry.isToday)) {
                    dateEl.className += " bright";
                }

                dateEl.innerHTML = group.label;
                dateEl.style = "padding-bottom: 5px;";
                if (i > 0) {
                    dateEl.style = "padding-bottom: 5px; padding-top: 15px;";
                }
                wrapper.appendChild(dateEl);
                
                var processedCandleLighting = false;

                for (var e in group.entries) {
                    const entry = group.entries[e];
                    var eventEl = document.createElement("div");
                    eventEl.className = "medium";

                    if (entry.title.includes("✨")
                            || entry.title.includes("🕯️")
                            || entry.title.includes("🛑")
                            || entry.title.includes("🍽️")) {
                        eventEl.style = "display: inline;";
                    }

                    if (entry.title.includes("🛑")) {
                        eventEl.style = "display: inline; padding-right: 50px;";
                    }

                    if (entry.title.includes("🕯️")) {
                        if (!processedCandleLighting) {
                            eventEl.style = "display: inline; padding-right: 50px;";
                        }

                        processedCandleLighting = true;
                    }

                    if (entry.title.includes("✨") && group.type === "boundary" && group.entries.length >= 3) {
                        eventEl.style = "";
                    }

                    if (entry.isToday) {
                        eventEl.className = eventEl.className + " bright";
                    }

                    eventEl.innerHTML = entry.title;
                    wrapper.appendChild(eventEl);
                }
            }
        }

        return wrapper;
    },

    updateTimes: function() {
        var self = this;
        var url = self.makeURL("now");
        this.today = new Date();

        self.makeTimesRequest(url, function(data) {
            var times = data['items'];
            if (self.today.getDate() < 7 && self.today.getMonth() === 0) {
                url = self.makeURL((self.today.getFullYear() - 1).toString());
                self.makeTimesRequest(url, function(data2) {
                    var times2 = data2['items'];
                    self.processTimes(times2.concat(times));
                });
            } else {
                self.processTimes(times);             
            }
        });
    },
    
    makeTimesRequest: function(url, callback) {
        var self = this;
        var timesRequest = new XMLHttpRequest();
        timesRequest.open("GET", url, true);
        timesRequest.onreadystatechange = function() {
            if (this.readyState === 4) {
                if (this.status === 200) {
                    callback(JSON.parse(this.response));
                    return;
                } else {
                    Log.error(self.name + ": Could not load shabbat updateTimes.");
                }

                self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
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

    makeURL: function(year) {
        var c = this.config

        var ashkenaz = "on"
        if (!c.ashkenaz) {
            ashkenaz = "off"
        }

        return "https://www.hebcal.com/hebcal?" + [
            "v=1",
            "cfg=json",
            "b=" + c.minutesBefore,
            "a=" + ashkenaz,
            "maj=on",
            "min=on",
            "mod=on",
            "nx=on",
            "year=" + year,
            "month=x",
            "ss=on",
            "mf=on",
            "c=on",
            "o=on",
            "s=on",
            "leyning=off",
            "geo=pos",
            "latitude=" + c.latitude,
            "longitude=" + c.longitude,
            "tzid=" + c.tzid
        ].join("&");
    },
    
    isAfterDate: function(date, isAfter) {

        const a = new Date(date.getTime());
        const b = new Date(isAfter.getTime());
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
        const sortedItems = this.sortItemsByDate(items);

        // Candle lighting and Havdallah
        const itemsAfterNow = sortedItems.filter(item => this.isAfterToday(new Date(item["date"])));
        const itemsBeforeNow = sortedItems.filter(item => !this.isAfterToday(new Date(item["date"])));

        const havdallahItemsAfterNow = itemsAfterNow.filter(item => item["title"].includes("Havdalah:"));
        const havdallahItemsBeforeNow = itemsBeforeNow.filter(item => item["title"].includes("Havdalah:"));
        const nextHavdallah = (havdallahItemsAfterNow.length > 0) ? havdallahItemsAfterNow[0] : null;
        const prevHavdallah = (havdallahItemsBeforeNow.length > 0) ? havdallahItemsBeforeNow[havdallahItemsBeforeNow.length - 1] : null;
        const nextHavdallahTime = (nextHavdallah != null) ? new Date(nextHavdallah["date"]).getTime() : null;
        const prevHavdallahTime = (prevHavdallah != null) ? new Date(prevHavdallah["date"]).getTime() : null;
        const candleLightings = sortedItems.filter(item => {
            if (!this.isBoundaryItem(item)) { return false; }

            const itemTime = new Date(item["date"]).getTime();

            if (prevHavdallahTime != null && itemTime <= prevHavdallahTime) {
                return false;
            }

            if (nextHavdallahTime != null && itemTime > nextHavdallahTime) {
                return false;
            }

            return true;
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
            if (fastStart != null) {
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
        }
    
        
        
        const todayItems = itemsAfterNow.filter(item => this.isToday(moment(item["date"]).toDate())
                                                    && item["category"] != "candles"
                                                    && item["category"] != "havdalah"
                                                    && item["subcat"] != "fast"
                                                    && !item["title"].includes("Parash")
                                               );
        
        
       return this.sortItemsByDate([...todayItems, ...fastItems, ...candleLightings]);
        
    },

    processTimes: function(items) {
        this.items = items;
        this.loaded = true;
        this.updateDom(this.config.animationSpeed);
    }
})
