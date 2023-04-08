const { Builder, Key, By } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const service = new chrome.ServiceBuilder("./chromedriver");

let options = new chrome.Options()
  .addArguments("--disable-infobars")
  .addArguments("--disable-dev-shm-usage")
  .addArguments("--no-sandbox")
  .addArguments("--remote-debugging-port=9515")
  .addArguments("lang=pt-br");

const questionTxt =
  "Tudo pronto para realizar os envios? Digite S para continuar: ";

const clipboardy = require("node-clipboardy");

const report = [];

async function getDriver() {
  let driver = await new Builder()
    .forBrowser("chrome")
    .setChromeService(service)
    .setChromeOptions(options)
    .build();
  return driver;
}

async function showQuestionUser(questionTxt) {
  const qtMaxAttemp = 5;
  const validResponse = "s";
  let qtAttemp = 0;
  let isSuccess = false;
  let responseUser = "";

  do {
    console.clear();
    responseUser = await getResponseUser(questionTxt);
    if (responseUser.toLowerCase() === validResponse) {
      isSuccess = true;
      break;
    }
    responseUser = "";
    qtAttemp++;
  } while (qtAttemp <= qtMaxAttemp);

  return isSuccess;
}

async function getResponseUser(questionTxt) {
  const readline = require("readline");
  const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    reader.question(questionTxt, (text) => {
      reader.close();
      resolve(text);
    });
  });
}

async function findAndSelectContact(driver, contact) {
  let returnDTO = {
    wasSuccess: false,
    nmStep: "findAndSelectContact",
    exceptionMessage: "",
  };

  try {
    const divSearch = await driver.findElement(
      By.xpath("/html/body/div[1]/div/div/div[4]/div/div[1]/div/div/div[2]")
    );

    await divSearch.click();

    const inputSearchContact = await driver.findElement(
      By.xpath('//*[@id="side"]/div[1]/div/div/div[2]/div/div[1]/p')
    );

    await inputSearchContact.sendKeys(contact);
    await driver.sleep(2000); // Aguarda 2 segundos

    const elements = await driver.findElements(
      By.xpath(`//span[@title='${contact}']`)
    );

    await elements[0].click();
    await driver.sleep(2000); // Aguarda 2 segundos
    returnDTO.wasSuccess = true;
  } catch (error) {
    returnDTO.wasSuccess = false;
    returnDTO.exceptionMessage = error.message;
  }

  return returnDTO;
}

async function inputAndSendMessage(driver, message) {
  let returnDTO = {
    wasSuccess: false,
    nmStep: "inputAndSendMessage",
    exceptionMessage: "",
  };

  try {
    const inputTxtMsg = await driver.findElement(
      By.xpath(
        "/html/body/div[1]/div/div/div[5]/div/footer/div[1]/div/span[2]/div/div[2]/div[1]/div/div[1]/p"
      )
    );

    await inputTxtMsg.click();

    //Copio a mensagem para a área de transferência, assim consigo manter os emotions
    //e as quebras de linha
    clipboardy.writeSync(message);

    //Utilizo o recurso de colar, para assim manter a estrutura do texto
    await inputTxtMsg.sendKeys(Key.chord(Key.CONTROL, "Shift", "v"));

    await driver.sleep(4000); // Aguarda 4 segundos
    const btnSend = await driver.findElement(
      By.xpath(
        "/html/body/div[1]/div/div/div[5]/div/footer/div[1]/div/span[2]/div/div[2]/div[2]/button"
      )
    );
    await btnSend.click();
    returnDTO.wasSuccess = true;
  } catch (error) {
    returnDTO.wasSuccess = false;
    returnDTO.exceptionMessage = error.message;
  }

  return returnDTO;
}

async function cleanContactSearch(driver) {
  let returnDTO = {
    wasSuccess: false,
    nmStep: "cleanContactSearch",
    exceptionMessage: "",
  };

  try {
    const btnCleanSearch = await driver.findElement(
      By.xpath(
        "/html/body/div[1]/div/div/div[4]/div/div[1]/div/div/span/button/span"
      )
    );
    await btnCleanSearch.click();
    returnDTO.wasSuccess = true;
  } catch (error) {
    returnDTO.wasSuccess = false;
    returnDTO.exceptionMessage = error.message;
  }

  return returnDTO;
}

async function saveReport(returnDTO, contact) {
  report.push({
    contact: contact,
    wasSend: returnDTO.wasSuccess,
    exceptionMessage: returnDTO.exceptionMessage,
    nmStep: returnDTO.nmStep,
  });
}

function getItems() {
  const items = [
    {
      contact: "Thiago Lima",
      message: "Mensagem sendo enviada para o mesmo contato\n 😘",
    },
    {
      contact: "Thiago Lima",
      message: "Para mais códigos e projetos legais",
    },
    {
      contact: "Thiago Lima",
      message: "Visite: https://github.com/tglima",
    },
  ];
  return items;
}

async function main() {
  let returnDTO = {
    wasSuccess: false,
    nmStep: "",
    exceptionMessage: "",
  };

  const driver = await getDriver();
  await driver.get("https://web.whatsapp.com");

  const mustContinue = await showQuestionUser(questionTxt);

  if (!mustContinue) {
    returnDTO.nmStep = "questionUser";
    returnDTO.wasSuccess = false;
    returnDTO.exceptionMessage = "Não foi possível continuar";
    saveReport(returnDTO, "");
    console.log(returnDTO);
  }

  const items = getItems();

  for (const i of items) {
    returnDTO = await findAndSelectContact(driver, i.contact);

    if (!returnDTO.wasSuccess) {
      saveReport(returnDTO, i.contact);
      await cleanContactSearch(driver);
      continue;
    }

    returnDTO = await inputAndSendMessage(driver, i.message);

    if (!returnDTO.wasSuccess) {
      saveReport(returnDTO, i.contact);
      await driver.navigate().refresh(); //Recarrego a página apenas para garantir que não fique travado o próximo envio.
      await driver.sleep(5000); // Aguarda 5 segundos
      continue;
    }

    returnDTO = await cleanContactSearch(driver);

    if (!returnDTO.wasSuccess) {
      returnDTO.wasSuccess = true; //Se chegou até o método cleanContactSearch, significa que a mensagem foi enviada.
      await driver.navigate().refresh(); //Recarrego a página apenas para garantir que não fique travado o próximo envio.
      await driver.sleep(5000); // Aguarda 5 segundos
    }

    saveReport(returnDTO, i.contact);
  }
}

function showReport() {
  let qtTotalSchedules = 0;
  let qtTotalError = 0;
  let qtTotalSend = 0;

  report.forEach((item) => {
    if (!item.wasSend) {
      qtTotalError++;
    }
  });

  qtTotalSchedules = report.length;
  qtTotalSend = qtTotalSchedules - qtTotalError;

  let reportMin = {
    "Nº de mensagens agendadas": qtTotalSchedules,
    "Nº de mensagens não enviadas": qtTotalError,
    "Nº de mensagens enviadas": qtTotalSend,
  };

  console.log(JSON.stringify(reportMin, null, "\t"));
}

main().then(() => {
  showReport();
});
