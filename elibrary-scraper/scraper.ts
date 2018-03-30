import * as cheerio from "cheerio";

import * as cache from "./cache";
import * as net from "./net";

async function getContractorInfoHTML(contract: string): Promise<string> {
    const url = await cache.get(`url_${contract}`, () => net.getContractorInfoURL(contract));

    return cache.get(`html_${contract}`, () => net.getContractorInfoHTML(url));
}

interface ContractorInfo {
    name: string;
    website?: string;
    duns?: string;
    naics?: string;
    address?: string;
}

interface ContractInfo {
    contractor: ContractorInfo;
    number: string;
    endDate: string;
    sins: string[];
}

interface StrMapping {
    [key: string]: string|undefined;
}

function parseContractorInfo($: CheerioStatic, table: Cheerio): ContractorInfo {
    const column = table.find('table:nth-child(1) table:nth-child(1)').first();
    const raw: StrMapping = {};

    column.find('tr').each((i, rowEl) => {
        const name = $(rowEl).find('td:nth-child(1)').text().trim().toLowerCase().slice(0, -1);
        const value = $(rowEl).find('td:nth-child(2)');

        value.find('br').replaceWith($('<span>\n</span>'));

        raw[name] = value.text().trim();
    });

    const name = raw['contractor'];

    if (!name) {
        throw new Error('could not find contractor name!');
    }

    const result: ContractorInfo = { name };

    if (raw['web address']) result.website = raw['web address'];
    if (raw.duns) result.duns = raw.duns;
    if (raw.naics) result.naics = raw.naics;
    if (raw.address) result.address = raw.address;

    return result;
}

function parseContractorInfoHTML(html: string): ContractInfo {
    const $ = cheerio.load(html);

    const skipnav = $('a[name="skipnavigation"]');

    if (skipnav.length !== 1) {
        throw new Error('could not find skipnavigation target!');
    }

    const table = skipnav.closest('table').next('table');
    const sourcesTable = table.find('table:nth-child(2)');
    const contractRow = sourcesTable.find('tr:nth-child(2)');
    const number = contractRow.find('td:nth-child(3)').text().trim();
    const endDate = contractRow.find('td:nth-child(5)').text().trim();
    const sins = contractRow.find('td:nth-child(6) a')
        .map((i, a) => $(a).text()).get();

    const result: ContractInfo = {
        contractor: parseContractorInfo($, table),
        number,
        sins,
        endDate
    };

    return result;
}

if (module.parent === null) {
    const contract = process.argv[2] || 'GS-10F-0247K';

    console.log(`Getting info for contract ${contract}...`);

    getContractorInfoHTML(contract)
        .then(html => {
            console.log(parseContractorInfoHTML(html));
        }).catch(e => {
            console.error(e);
            process.exit(1);
        });
}