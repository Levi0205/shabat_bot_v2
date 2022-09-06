const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config()
const bot = new TelegramBot(process.env.Telegram_Tokin, {polling: true});
const axios = require('axios');
const fs = require('fs');
const path = './db.json';
fs.appendFileSync(path, "[]");
let db = JSON.parse(fs.readFileSync(path, 'utf8'));
const KosherZmanim = require("kosher-zmanim");


const createUser = user => {
    db.push(user)
    fs.writeFileSync('db.json', JSON.stringify(db))
    return user
}

const updateUser = (user, data) => {
    Object.assign(user, data)
    fs.writeFileSync('db.json', JSON.stringify(db))
    return user
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
        bot.sendMessage(chatId, `Welcome back, ${user.first_name}${user.last_name ? ' '+user.last_name : ''}!`)
    } else {
        user = createUser({
            id: chatId,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name,
            lang,
            updateDate: (new Date()).toUTCString()
        })
        bot.sendMessage(chatId, `Welcome, ${user.first_name}${user.last_name ? ' '+user.last_name : ''}!\nPush Location Request`, locationRequestOptions)
    }
});

bot.on('location', (msg) => {
    const chatId = msg.chat.id;
    const user = db.find(user => user.id === chatId);
    const lang = msg.from.language_code;
    
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

                    const currDate = new Date();
                    const isFridayAfter12 = currDate.getDate() === 5 && currDate.getUTCHours() >= 12;

                    const nextFriday = new Date();
                    nextFriday.setUTCDate( nextFriday.getUTCDate() + 5 - nextFriday.getUTCDay() )
                    nextFriday.setUTCHours( 12, 0, 0, 0 );

                    if (nextFriday - currDate < 0) {
                        nextFriday.setUTCDate( nextFriday.getUTCDate() + 7 )
                    }

                    const shabathTime = getCandleTime(user, isFridayAfter12 ? currDate : nextFriday);

                    
                    const options = { month: 'long', day: 'numeric' };
                    bot.sendMessage(
                        msg.chat.id,
                        `📍 ${location}\nШабат: ${nextFriday.toLocaleDateString(lang, options)}\nЗажигание 🕯🕯 в ${shabathTime.time}`
                    )

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
    if (CL.getSeconds() > 30)
        CL.setMinutes( CL.getMinutes() + 1 )
    const time = CL.toLocaleTimeString(user.lang, { timeZone: user.timeZoneId })
    const hours = +time.split(':')[0] - user.timeShift
    const minutes = time.split(':')[1]
    const usaStyle = time.match(/'am|pm|AM|PM'/gi)
    const ShabatTime = {
        date: CL.toDateString(),
        time: hours+':'+minutes + (usaStyle || '')
    }
    
    return ShabatTime
}

function sendCandleTime( user ) {
    const shabath = getCandleTime( user, new Date() )
    bot.sendMessage(chatID,`шабат дата ${shabath.date} шабат время ${shabath.time}`)
    setTimeout( () => sendCandleTime(user), 60480000)
}

