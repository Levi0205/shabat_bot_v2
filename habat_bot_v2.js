const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config()
const bot = new TelegramBot(process.env.Telegram_Tokin, {polling: true});
const axios = require('axios');
const fs = require('fs');
const KosherZmanim = require("kosher-zmanim");


let userLocation ;

let nextFriday = new Date()
nextFriday.setDate(nextFriday.getDate()+ (5 - nextFriday.getDay()))


bot.onText(/start/, (msg) => {
    const opts = {
        reply_markup: JSON.stringify({
            keyboard: [
                [{text: 'Location Request', request_location: true}],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
        }),
    };
    bot.sendMessage(msg.chat.id, 'нажмите на кнопку Location Request', opts);
});

bot.on('location', (msg) => {
    const lg = msg.from.language_code;
    const urlPlace = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${msg.location.latitude},${msg.location.longitude}&key=${process.env.googl_aip_key}&language=${lg}`
    const urlTimezone = `https://maps.googleapis.com/maps/api/timezone/json?location=${msg.location.latitude}%2C${msg.location.longitude}&timestamp=${Math.floor((+new Date())/1000)}&key=${process.env.googl_aip_key}`
    

    axios.get(urlPlace)
        .then( res => {
            axios.get(urlTimezone)
                .then( tzres => {
                    

                    const timeShift = (tzres.data.rawOffset + tzres.data.dstOffset) / 3600

                    

                    let location = res.data.plus_code.compound_code
                    location = location.slice( location.indexOf(' ') + 1 )
                    console.log("Location", location)

                    const currDate = new Date();
                    const isFridayAfter12 = currDate.getDate() === 5 && currDate.getUTCHours() >= 12;

                    const nextFriday = new Date();
                    nextFriday.setUTCDate( nextFriday.getUTCDate() + 5 - nextFriday.getUTCDay() )
                    nextFriday.setUTCHours( 12, 0, 0, 0 );

                    if (nextFriday - currDate < 0) {
                        nextFriday.setUTCDate( nextFriday.getUTCDate() + 7 )
                    }
                    

                    const shabathTime = getCandleTime({
                        latitude: msg.location.latitude,
                        longitude: msg.location.longitude,
                        timeZoneId: tzres.data.timeZoneId,
                        timeShift,
                        date: isFridayAfter12 ? currDate : nextFriday,
                        lang: lg
                    });
                    const options = { month: 'long', day: 'numeric' };
                    bot.sendMessage(
                        msg.chat.id,
                        `📍 ${location}\nШабат: ${nextFriday.toLocaleDateString(lg, options)}\nЗажигание 🕯🕯 в ${shabathTime.time}`
                    )

                    setTimeout( 
                        () => sendCandleTime(msg.chat.id, msg.location.latitude, msg.location.longitude),
                        nextFriday - currDate - (timeShift * 60 * 60 * 1000)
                    )
                   
                })
        })
    

});

function getCandleTime ( {latitude, longitude, timeZoneId, timeShift, date, lang} ){
    const options = {
        date,
        latitude,
        longitude,
    };
    const zmanim = KosherZmanim.getZmanimJson(options);
    const Dat =  new Date(zmanim.BasicZmanim.CandleLighting)
    const kostyli = zmanim.BasicZmanim.CandleLighting.split('T')[1].split(':').splice(0, 2).join(':')
    Dat.setUTCHours( Dat.getUTCHours() + timeShift )
    if (Dat.getSeconds() > 30)
        Dat.setMinutes( Dat.getMinutes() + 1 )
    const time = Dat.toLocaleTimeString(lang, {timeZone: timeZoneId})
    const hours = +time.split(':')[0] - timeShift
    const minutes = time.split(':')[1]
    const usaStyle = time.match(/'am|pm'/gi)
    const ShabatTime = {
        date: Dat.toDateString(),
        time: hours+':'+minutes + (usaStyle || '')
    }
    
    return ShabatTime
}
function sendCandleTime( chatID, latitude, longitude ) {
    const shabath = getCandleTime( latitude, longitude, new Date() )
    bot.sendMessage(chatID,`шабат дата ${shabath.date} шабат время ${shabath.time}`)
    setTimeout( () => sendCandleTime(chatID, latitude, longitude), 60480000)
}
