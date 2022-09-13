const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config()
const bot = new TelegramBot(process.env.Telegram_Tokin, {polling: true});
const axios = require('axios');
const fs = require('fs');
const path = './db.json';
if ( !fs.existsSync(path) ) {
    fs.writeFileSync(path, "[]");
}
let db = JSON.parse(fs.readFileSync(path, 'utf8'));
const KosherZmanim = require("kosher-zmanim");

const createUser = user => {
    db.push(user)
    fs.writeFileSync(path, JSON.stringify(db))
    return user
}

const updateUser = (user, data) => {
    Object.assign(user, data)
    fs.writeFileSync(path, JSON.stringify(db))
    return user
}
const getNextFriday = (date = new Date()) => {
    const nextFriday = new Date(date);
    nextFriday.setUTCDate( nextFriday.getUTCDate() + 5 - nextFriday.getUTCDay() )
    nextFriday.setUTCHours( 12, 0, 0, 0 );
    return nextFriday;
}

const calcDate = timeShift => {
    const currDate = new Date();
    const isFridayAfter12 = currDate.getDate() === 5 && currDate.getUTCHours() + timeShift >= 12;

    const nextFriday = getNextFriday();
    

    if (nextFriday - currDate < 0) {
        nextFriday.setUTCDate( nextFriday.getUTCDate() + 7 )
    }

    return {currDate, nextFriday, isFridayAfter12, testFriday}
}
const getMessage = ({ user, currDate, nextFriday, isFridayAfter12 }) => {
    const shabathTime = getCandleTime(user, isFridayAfter12 ? currDate : nextFriday);

    const options = { month: 'long', day: 'numeric' };
    return `Шабат: ${nextFriday.toLocaleDateString(user.lang, options)}\nЗажигание 🕯🕯 в ${shabathTime.time}`
}


bot.onText(/start/, (msg) => {
    const chatId = msg.chat.id;
    const lang = msg.from.language_code;
    const locationRequestOptions = {
        reply_markup: JSON.stringify({
            keyboard: [
                [{text: 'Location Request', request_location: true}],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        }),
    };

    let user = db.find(user => user.id === chatId);

    if (user) {
        const {currDate, nextFriday, isFridayAfter12} = calcDate(user.timeShift)
        const test = bot.sendMessage( user.id, `Welcome back, ${user.first_name}${user.last_name ? ' '+user.last_name : ''}!${getMessage({ user, currDate, nextFriday, isFridayAfter12 })}`, locationRequestOptions)
        
    } else {
        user = createUser({
            id: chatId,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            lang,
            updateDate: (new Date()).toUTCString()
        })
        bot.sendMessage( user.id, `Welcome, ${user.first_name}${user.last_name ? ' '+user.last_name : ''}!\nPush Location Request`, locationRequestOptions)
    }
});

bot.on('location', (msg) => {
    const chatId = msg.chat.id;
    const lang = msg.from.language_code;
    const user = db.find(user => user.id === chatId);
    if (!user) {
        user = createUser({
            id: chatId,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            lang,
            updateDate: (new Date()).toUTCString()
        })
    }
    
    const urlPlace = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${msg.location.latitude},${msg.location.longitude}&key=${process.env.googl_aip_key}&language=${lang}`
    const urlTimezone = `https://maps.googleapis.com/maps/api/timezone/json?location=${msg.location.latitude}%2C${msg.location.longitude}&timestamp=${Math.floor((+new Date())/1000)}&key=${process.env.googl_aip_key}`
    
    axios.get(urlPlace)
        .then( res => {
            axios.get(urlTimezone)
                .then( tzres => {
                    const timeShift = (tzres.data.rawOffset + tzres.data.dstOffset) / 3600

                    let location = res.data.plus_code.compound_code
                    location = location.slice( location.indexOf(' ') + 1 )
                    console.log("Location", location)

                    updateUser( user, {
                        latitude: msg.location.latitude,
                        longitude: msg.location.longitude,
                        timeZoneId: tzres.data.timeZoneId,
                        location: {
                            city: location,
                            country: location,
                            name: location
                        },
                        timeShift
                    })

                    const {currDate, nextFriday, isFridayAfter12, testFriday} = calcDate(user.timeShift)
                    
                    bot.sendMessage( user.id, `📍 ${location}\n${getMessage({ user, currDate, nextFriday, isFridayAfter12 })}` )

                    setTimeout( () => sendCandleTime(user), nextFriday - currDate - (timeShift * 60 * 60 * 1000) );
                    
                    
                })
        })
    

});

function getCandleTime ( user, date ) {
    const options = {
        date,
        latitude: user.latitude,
        longitude: user.longitude,
    };
    const zmanim = KosherZmanim.getZmanimJson(options);
    const CL =  new Date(zmanim.BasicZmanim.CandleLighting)
    CL.setUTCHours( CL.getUTCHours() + user.timeShift )
    
    const time = CL.toLocaleTimeString(user.lang, { timeZone: user.timeZoneId })
    const hours = +time.split(':')[0] - user.timeShift
    const minutes = time.split(':')[1]
    const usaStyle = time.match(/'am|pm|AM|PM'/gi)
    return {
        date: CL.toDateString(),
        time: hours+':'+minutes + (usaStyle || '')
    }
}
function sendCandleTime( user ) {
    const { date, time } = getCandleTime( user, new Date() )
    bot.sendMessage( user.id, `шабат дата ${date} шабат время ${time}`)
    setTimeout( () => sendCandleTime(user), 60480000)
}
