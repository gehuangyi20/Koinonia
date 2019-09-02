/**
 * Created by Victor on 11/16/2016.
 */
var webdriver = require('selenium-webdriver'),
    By = webdriver.By,
    until = webdriver.until;

var driver = new webdriver.Builder()
    .forBrowser('chrome')
    .build();

driver.get('http://localhost:3000');
driver.findElement(By.linkText('Create Election')).click();

driver.wait(until.urlMatches('http://localhost:3000/create'), 2000);
driver.findElement(By.name('name')).sendKeys('Test Election');
for (var i = 1; i < 10; i++) {
    driver.findElement(By.name('add')).click();
    driver.wait(until.elementLocated(By.name('candidate' + i)))
        .sendKeys('candidate ' + i);
}
driver.findElement(By.name('submit')).click();

driver.wait(until.urlMatches('http://localhost:3000/create/.*/'));
var url;
driver.getCurrentUrl().then(function (loc) {
    url = loc;
});
driver.findElement(By.name('freeze')).click();
driver.wait(until.elementLocated(By.id('register_button')));

for (i = 0; i < 5; i++) {
    driver.executeScript("window.open()");
}
var servers = [];
var windows = [];
driver.getAllWindowHandles().then(function (handles) {
    servers.push(handles[0]);
    servers.push(handles[1]);
    servers.push(handles[2]);
    windows = handles;

});
for (j in servers) {
    driver.switchTo(servers[j]);
    driver.findElement(By.id('register_button')).click();
}
driver.findElement(By.name('open')).click();
var votes =[];
for(j in windows){
    driver.switchTo(windows[j])
        .wait(until(until.elementLocated(By.name('vote'))))
        .click();
    var vote =Math.random() *10;
    votes[vote]++;
    driver.wait(until(until.elementLocated(By.css('vote'))))
        .click()

}

driver.quit();