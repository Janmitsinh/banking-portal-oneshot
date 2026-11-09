const fs = require('fs');
const path = require('path');

const defaultData = () => ({ customers: [], accounts: [], transactions: [] });

function createStore(filePath) {
  const resolved = path.resolve(filePath);
  function read() {
    try {
      if (!fs.existsSync(resolved)) {
        fs.writeFileSync(resolved, JSON.stringify(defaultData()), 'utf8');
      }
      const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
      return {
        customers: Array.isArray(parsed.customers) ? parsed.customers : [],
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : []
      };
    } catch (error) {
      throw new Error(`Unable to read data store: ${error.message}`);
    }
  }
  function write(data) {
    try {
      fs.writeFileSync(resolved, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Unable to write data store: ${error.message}`);
    }
  }
  return { read, write };
}

module.exports = { createStore, defaultData };
