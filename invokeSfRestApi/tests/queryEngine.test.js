const queryEngine = require('../queryEngine');

jest.mock('../sfRestApi');
jest.mock('../SCVLoggingUtil');
const api = require("../sfRestApi");
const SCVLoggingUtil = require("../SCVLoggingUtil");


describe('SSMUtil Tests',  () => {

    it('Sample SSMUtil tests', async () => {
        const query = "SELECT {name} FROM Account";
        const args = { name: "Test User" };

        await queryEngine.invokeQuery(query, args);
        expect(SCVLoggingUtil.debug).toHaveBeenCalledWith({
            message: "invoke query from SfRestApi",
            context: { payload : "SELECT Test User FROM Account"},
        });
    });

});
