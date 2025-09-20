import os
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait  # Import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from dotenv import load_dotenv
from selenium.webdriver import ChromeService
from seleniumwire import webdriver
from selenium.common.exceptions import NoSuchElementException
#from selenium.webdriver.common.action_chains import ActionChains
from discord_webhook import DiscordWebhook, DiscordEmbed
import time
#import json

load_dotenv()
def check_login_state(driver):
    try:
        driver.find_element(By.CSS_SELECTOR, "#main-header-menu > div > div.right-panel.ng-tns-c1251938777-2.ng-star-inserted > div.my-account.ng-tns-c1251938777-2 > div.my-account__content.ng-tns-c1251938777-2.ng-star-inserted > div.auth-user.ng-tns-c1251938777-2 > button.ng-tns-c1251938777-2")
    except NoSuchElementException:
        print("Not authorized ... attempting to login")
        login(driver)
    print("Logged in ... continuing")
    return True
    
def schedule(driver):       
    check_login_state(driver)
    
    #go to URL
    url = "https://info-car.pl/new/prawo-jazdy/sprawdz-wolny-termin"
    #with open('cookies.json', 'r') as file:
    #    cookies = json.load(file)
    driver.get(url)
    #for cookie in cookies:
    #    driver.add_cookie(cookie)
    time.sleep(3)
    
    #select exam type:
    driver.find_elements(By.XPATH, "//*[@id='exam'][1]/div")[0].click()
    try:
        driver.find_element(By.ID, "cookiescript_accept").click()
    except NoSuchElementException:
        pass
    #select region:
    time.sleep(0.3)
    driver.find_element(By.ID, "province").click()
    Webelement = driver.find_element(By.ID, "wielkopolskie")
    driver.execute_script("arguments[0].scrollIntoView()", Webelement)
    time.sleep(0.2)   
    Webelement.click();

    
    #select OSK:
    time.sleep(0.3)
    driver.find_element(By.ID, "organization").click()
    Webelement = driver.find_element(By.ID, "word-poznań")
    driver.execute_script("arguments[0].scrollIntoView()", Webelement)
    Webelement.click();
    
    #select category:
    time.sleep(0.3)  
    driver.find_element(By.ID, "category-select").click()
    Webelement = driver.find_element(By.ID, "b")
    driver.execute_script("arguments[0].scrollIntoView()", Webelement)
    #time.sleep(0.5)   
    Webelement.click();
    
    #click on "Dalej: "
    time.sleep(0.3)
    driver.find_elements(By.XPATH, "/html/body/app-root/app-layout/app-check-exam-availability/div/main/app-exam-availability-exam-center-step/div/section[2]/div/ic-ghost-button/button")[0].click()
    print("Requesting schedule from info-car")
    
    #select exam type:"
    time.sleep(1.5)
    driver.find_element(By.CSS_SELECTOR, "[aria-label=PRACTICE]").click()
        
    #get first exam datetime:
    time.sleep(0.5)
    examDate = driver.find_elements(By.XPATH, '//*[contains(@class, "accordion-header")]/button/h5')[0].text
    examTime = driver.find_elements(By.XPATH, '//*[contains(@class, "exam-time")]')[0].text
    examSlots = driver.find_elements(By.XPATH, '//*[contains(@class, "exam-places")]')[0].text
    print("=== FASTEST POSSIBLE EXAM: ===")
    print(examDate, examTime, "- Places:",examSlots)
    return examDate, examTime, examSlots
    
def login(driver):
    loginurl = "https://info-car.pl/oauth2/login"
    #with open('cookies.json', 'r') as file:
    #    cookies = json.load(file)
    driver.get(loginurl)
    #for cookie in cookies:
    #   driver.add_cookie(cookie)
    email = os.getenv("EMAIL")
    password = os.getenv("PASSWORD")
    driver.find_element(By.ID, "username").send_keys(email)
    driver.find_element(By.ID, "password").send_keys(password)
    driver.find_element(By.ID, "register-button").click()
    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "#main-header-menu > div > div.right-panel.ng-tns-c1251938777-2.ng-star-inserted > div.my-account.ng-tns-c1251938777-2 > div.my-account__content.ng-tns-c1251938777-2.ng-star-inserted > div.auth-user.ng-tns-c1251938777-2 > button.ng-tns-c1251938777-2"))
        )
    except:
        print("Error during login!")
        
    #save login cookies for later use
        #cookies = driver.get_cookies()
        #with open('cookies.json', 'w') as file:
        #    json.dump(cookies, file) 
    print("Sucesfully logged in ... continuing")
    
#START
clear = lambda: os.system('cls') 
clear()
while (True):
    try:
        project_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        chromedriver_path = os.path.join(project_dir, "utils", "chromedriver.exe")
        options = webdriver.ChromeOptions()
        options.add_argument('--silent')
        #options.add_argument('--headless')
        options.add_argument('--log-level=3')
        options.page_load_strategy = 'normal'
        service = ChromeService(executable_path=chromedriver_path)
        driver = webdriver.Chrome(service=service, options=options)
        #action = ActionChains(driver)

        webhookUrl=os.environ.get('DISCORDURL')
        previousExamInfo = "NULL"

        while (True):
            #clear = lambda: os.system('cls') 
            #clear()
            url = "https://info-car.pl/new/prawo-jazdy/sprawdz-wolny-termin"
                #with open('cookies.json', 'r') as file:
                #    cookies = json.load(file)
            driver.get(url)
                #for cookie in cookies:
                #    driver.add_cookie(cookie)
            time.sleep(2)   
            examTime = "NULL"
            examDate = "NULL"
            examSlots = "NULL"
            #check for new date
            print("===============================================")
            print("Searching for new exam date...")
            examDate, examTime, examSlots = schedule(driver)
            examInfo=examDate+examTime+examSlots
            if examInfo != previousExamInfo:
                print("New date detected - sending notification...")
                webhook = DiscordWebhook(url=webhookUrl)
                embed = DiscordEmbed(title="Nowy dostępny termin egzaminu", description="<@veeon_>"+" - "+examDate+" - "+examTime, color="03b2f8")
                embed.add_embed_field(name="Data:", value=examDate+" - "+examTime, inline=False)
                embed.add_embed_field(name="Pozostałe miejsca:", value=examSlots, inline=False)
                embed.add_embed_field(name="Zarezerwuj termin:", value="https://info-car.pl/new/prawo-jazdy/sprawdz-wolny-termin", inline=False)
                webhook.add_embed(embed)
                response = webhook.execute()
            else:
                print("Date didn't change ... sleeping")
            previousExamInfo=examInfo
            # driver.quit()
            #loop delay (s)
            time.sleep(60)
    except:
        webhook = DiscordWebhook(url=webhookUrl)
        embed = DiscordEmbed(title="Błąd podczas sykonywania skryptu", description="<@406859750375030784>", color="03b2f8")
        embed.add_embed_field(name="Info:", value="Wystąpił błąd podczas wykonywania skryptu", inline=False)
        webhook.add_embed(embed)
        response = webhook.execute()  
        print("ERROR durring script execution! ... Restarting")
