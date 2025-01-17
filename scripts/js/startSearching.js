import fetch from "node-fetch";
import getToken from './getToken.js';
import getTokenReserv from './getTokenReserv.js';
import { takeReservation } from './take-reservation.js';
import { sleep } from './sleep.js';

export const startSearching = async () => {
    console.log("Retrieving authorization token...")
    let bearer_token = ""
    do {
        bearer_token = await getToken()
		console.log(bearer_token);
    } while(bearer_token == "")
	process.stdout.write('\x1Bc');
    let clearCount = 0;
	let firstCombined = 0;
	let previousFirstCombined = 0;
    let retryCount = 0;
	let firstDate = 0;
	let firstTime = 0;
	let firstPlaces = 0;
	let firstID = 0;	
	let fetchRate = 30; //delay between schedule download in s
	let reservationMade = 0;
	let slowMode = 0;
	let firstRun = 1;
    while (true) {
        try {
			//DELAY CONTROL
			if(firstRun==0){
				if(slowMode==0){
					await sleep(fetchRate * 1000);	
				} else{
					await sleep(2 * fetchRate * 1000);	
					slowMode--;
					console.log(` Slowmode active for next ${slowMode} runs`);
				}
			}
			firstRun=0;
			//GATHERING DATA
			console.log("==============INFO==============");
			console.log(" Updating schedule data...");
			if(reservationMade==1){
				console.log(" RESERVATION ALREADY MADE!");
				console.log(" RESTART SCRIPT TO RESERV NEW");
			}
            const response = await fetch(`https://info-car.pl/api/word/word-centers/exam-schedule`, {
                method: "PUT",
                body: JSON.stringify({
                    category: "B",
					endDate: process.env.DATE_TO,
					startDate: process.env.DATE_FROM,
					wordId: process.env.WORDID
                }),
                headers: {
					"Accept": "*/*",
					"Accept-Encoding": "deflate, gzip",
					"Host": "info-car.pl",
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "Content-Type": "application/json",
                    "Authorization": bearer_token
                }
            }).catch(err => { throw new Error(err); });
            if (response.status !== 200) {
                retryCount++;
                if (retryCount >= 5) {
                    console.log(" Too many tries to fetch...");
                    process.exit();
                }
                console.log(" Retrieving new auth token...");
                bearer_token = ""
                do {
                    bearer_token = await getToken()
					console.log(bearer_token);
                } while(bearer_token == "")
                //console.clear();
                continue;
            } else retryCount = 0;
			const { schedule } = await response.json();
			
            //DATA FILTRATION
			const DATE_FROM = process.env.DATE_FROM;
            const DATE_TO = process.env.DATE_TO;	
            const DATE_FROM_RESERV = process.env.DATE_FROM_RESERVATION;
            const DATE_TO_RESERV = process.env.DATE_TO_RESERVATION;	
			const reservationMode = process.env.RESERVATIONMODE;	
				//Filter out days outside range
			var strictedScheduledDates = schedule
			var strictedScheduledDatesReserv = schedule
			strictedScheduledDates = strictedScheduledDates.scheduledDays.filter(date => { return ((new Date(date.day) >= new Date(DATE_FROM)) && (new Date(date.day) <= new Date(DATE_TO))) });
            strictedScheduledDatesReserv = strictedScheduledDatesReserv.scheduledDays.filter(date => { return ((new Date(date.day) >= new Date(DATE_FROM_RESERV)) && (new Date(date.day) <= new Date(DATE_TO_RESERV))) });
				//Filter out days without practice exams
			const strictedPractiseExams = strictedScheduledDates.filter(scheduledDate => { return scheduledDate.scheduledHours.some(scheduledHour => scheduledHour.practiceExams.length !== 0) });
            const strictedPractiseExamsReserv = strictedScheduledDatesReserv.filter(scheduledDate => { return scheduledDate.scheduledHours.some(scheduledHour => scheduledHour.practiceExams.length !== 0) });
			
			//FINDING FIRST DATE AND HOURS
			if (strictedPractiseExams.length !== 0) {
				let found = false;
				let firstFound = false;
				let smallestIndex;
				let scheduledHourIndex;
				console.log("+----------FIRST DATE----------+");
				console.log(`|          ${strictedPractiseExams[0].day}          |`);
				console.log("+----------FIRST HOURS---------+");
				for (const [i, hour] of strictedPractiseExams[0].scheduledHours.entries()) {
					if (hour.practiceExams.length !== 0) {
					console.log(`| ${hour.time} - Places: ${hour.practiceExams[0].places}         |`);
						if(firstFound == false){
							firstTime = hour.time;
							firstPlaces = hour.practiceExams[0].places;
						    firstID = hour.practiceExams[0].id;
						}
						firstFound = true;
					}
				}
				firstDate = strictedPractiseExams[0].day;
				firstCombined=firstDate+firstTime+firstID+firstPlaces;
				console.log("+----------FIRST TERM----------+");
				console.log(`| DATE: ${firstDate}             |`);
				console.log(`| TIME: ${firstTime}               |`);
				console.log(`| PLACES: ${firstPlaces}                    |`);
				console.log("+------------------------------+");
				
				//SENDING NOTIFICATIONS ABOUT NEW DATES
				if (previousFirstCombined != firstCombined){
					console.log(" Sending new date notifications...");
					//MACRODROID WEBHOOK
					if (process.env.NOTIFYMACRODROID == 1){
						fetch(
						  process.env.MACRODROIDURL,
						  {
							method: 'post',
							headers: {
							  'Content-Type': 'application/json',
							},
							body: firstDate+" - "+firstTime+" - Miejsc: "+firstPlaces,
						  }
						);						
					}
					//DISCORD WEBHOOK
					if (process.env.NOTIFYDISCORD == 1){
						fetch(
						  process.env.DISCORDURL,
						  {
							method: 'post',
							headers: {
							  'Content-Type': 'application/json',
							},
							body: JSON.stringify({
							  username: 'InfoCar - Bot',
							  content:
								'Zmiana najszybszego terminu: '+firstDate+" - "+firstTime+" - Places: "+firstPlaces,
							  embeds: [
								{
								  color: 11730954,
								  title: 'Data:',
								  description: firstDate+" - "+firstTime,
								  fields: [
									{
									  name: 'Wolnych miejsc:',
									  value: firstPlaces,
									},
									{
									  name: 'ID terminu:',
									  value: firstID,
									},
								  ],
								},
							  ],
							}),
						  }
						);
					}
					previousFirstCombined = firstCombined;
				}
				
				//SEARCHING FOR RESERVATION
                for (let y = 0; y < strictedPractiseExamsReserv.length; y++) {
					if (reservationMade == 0){
						let found = false;
						let smallestIndex;
						let scheduledHourIndex;
						console.log("\n");
						console.log("+--------PREFERED-DATE---------+");
						console.log(`|          ${strictedPractiseExamsReserv[y].day}          |`);
						console.log("+--------PREFERED HOURS--------+");
						for (const [i, hour] of strictedPractiseExamsReserv[y].scheduledHours.entries()) {
							if (hour.practiceExams.length !== 0 && hour.practiceExams[0].id != 0) {
								console.log(`| ${hour.time} - Places: ${hour.practiceExams[0].places}         |`);
								const index = process.env.PREFERRED_HOURS.split(",").indexOf(hour.time.split(":")[0]);
								if (found === false) {
									if (index > -1) {
										smallestIndex = index;
										scheduledHourIndex = i;
										found = true;
									}
								}
								else if ((index > -1) && (smallestIndex > index)) {
									smallestIndex = index;
									scheduledHourIndex = i;
								}
								
							}
						}
						console.log("+------------------------------+");
						console.log("\n");
						//TAKING RESERVATION
						if (scheduledHourIndex != undefined && reservationMade == 0 && reservationMode == 1) {
							console.log("+----TAKING RESERVATION FOR----+");
							console.log(`| DATE: ${strictedPractiseExamsReserv[y].day}             |`);
							console.log(`| TIME: ${strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].time}               |`);
							console.log(`| ID:   ${strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].practiceExams[0].id}    |`);
							console.log("+------------------------------+");
							console.log("Retrieving reservation authorization token...")
							let bearer_token_reserv = ""
							do {
								bearer_token_reserv = await getTokenReserv()
								console.log(bearer_token_reserv);
							} while(bearer_token_reserv == "")
								
							console.log(strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].practiceExams[0].date);
							reservationMade = 1;
							//SENDING NOTIFICATIONS ABOUT RESERVATION
							//MACRODROID WEBHOOK
							if (process.env.NOTIFYMACRODROID == 1){
								fetch(
								  process.env.MACRODROIDURLRESERV,
								  {
									method: 'post',
									headers: {
									  'Content-Type': 'application/json',
									},
									body: strictedPractiseExamsReserv[y].day+" - "+strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].time,
								  }
								);
							}
							//DISCORD WEBHOOK
							if (process.env.NOTIFYDISCORD == 1){
								fetch(
								  process.env.DISCORDURL,
								  {
									method: 'post',
									headers: {
									  'Content-Type': 'application/json',
									},
									body: JSON.stringify({
									  username: 'InfoCar - Bot',
									  content:
										'Zarezerwowano termin: '+strictedPractiseExamsReserv[y].day+" - "+strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].time,
									  embeds: [
										{
										  color: 11730954,
										  title: 'Data:',
										  description: strictedPractiseExamsReserv[y].day+" - "+strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].time,
										  fields: [
											{
											  name: 'Wolnych miejsc:',
											  value: strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].practiceExams[0].places,
											},
											{
											  name: 'ID terminu:',
											  value: strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].practiceExams[0].id,
											},
											{
											  name: 'DATA Z TERMINARZA:',
											  value: strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].practiceExams[0].date,
											},
										  ],
										},
									  ],
									}),
								  }
								);
							}
							await takeReservation(strictedPractiseExamsReserv[y].scheduledHours[scheduledHourIndex].practiceExams[0].id, bearer_token_reserv);
							//process.exit();
						}
					}
                }
            }
			console.log("\n");
			//AUTO CONSOLE CLEARING
            clearCount++;
            if (clearCount === 50) {
				process.stdout.write('\x1Bc');
                clearCount = 0;
            }
        } catch (err) {
			//ERROR HANDLING
			console.log(err);
			console.log("Enabling Slow Mode because of Error for next 5 runs...");
			slowMode = 5;
			}
    }
};