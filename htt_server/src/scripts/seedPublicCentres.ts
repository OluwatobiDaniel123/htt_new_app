/* eslint-disable @typescript-eslint/no-explicit-any */
import { Op } from "sequelize";
import { models, sequelize } from "../models/index.js";

const websiteCentres = [
  {
    slug: "magodo",
    name: "Magodo Lagos Training Centre",
    code: "MAGODO",
    area: "Magodo",
    city: "Magodo",
    region: "Lagos State",
    address: "CMD Road, Magodo, Astute Football Turf, Lagos.",
    mapLink: "https://maps.app.goo.gl/47KNHWcm26EC22k69",
    schedule: "1 Sessions/Week, 2 Hour/Session - Saturday Only · 10:00 AM – 12:00 PM",
    mapEmbed: "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3963.1903583907388!2d3.3682491!3d6.623261!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x103b93a4e3b7dc65%3A0x30cb66ffc74fdbd9!2sTURF%20BALL!5e0!3m2!1sen!2sng!4v1787365700991!5m2!1sen!2sng",
  },
  {
    slug: "agege",
    name: "Agege Lagos Training Centre",
    code: "AGEGE",
    area: "Agege",
    city: "Agege",
    region: "Lagos State",
    address: "Pencinema, Vetland School, Agege, Lagos.",
    mapLink: "https://maps.google.com/?q=Ikeja+GRA+Lagos",
    schedule: "3 Sessions/Week, 2 Hour/Session - Monday, Wednesday & Friday · 4:00 PM – 6:00 PM",
    mapEmbed: "https://www.google.com/maps/embed?pb=!1m16!1m12!1m3!1d15852.2891287695!2d3.3022427234787974!3d6.63794590918014!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!2m1!1sPencinema%2C%20Vetland%20School%2C%20Agege%2C%20Lagos!5e0!3m2!1sen!2sng!4v1787327499858!5m2!1sen!2sng",
  },
  {
    slug: "ogudu",
    name: "Ogudu Lagos Training Centre",
    code: "OGUDU",
    area: "Ogudu",
    city: "Ogudu",
    region: "Lagos State",
    address: "Ogudu GRA Phase 1, Ogudu Grammar School, Lagos.",
    mapLink: "https://maps.app.goo.gl/tBpURv5pEmtzTHB99",
    schedule: "2 Sessions/Week, 2 Hour/Session - Tuesday & Thursday · 4:00 PM – 6:00 PM",
    mapEmbed: "https://www.google.com/maps/embed?pb=!1m16!1m12!1m3!1d3963.548694826968!2d3.3838330749934014!3d6.578495593414981!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!2m1!1sOgudu%20GRA%20Phase%201%2C%20Ogudu%20Grammar%20School%2C%20Lagos.!5e0!3m2!1sen!2sng!4v1787365886241!5m2!1sen!2sng",
  },
] as const;

const websiteProgrammes = [
  {
    slug: "ogudu-programme-1",
    name: "Beginners",
    code: "BEGINNERS-8-11",
    description: "First kicks and fundamental movement in a fun, safe environment.",
    ageGroup: "Ages 8–11",
    ageGroupLabel: "Ages 8–11",
    ageMin: 8,
    ageMax: 11,
    approvedFee: "40000",
  },
  {
    slug: "ogudu-programme-2",
    name: "Developing Player",
    code: "DEVELOPING-11-14",
    description: "Advanced football development for aspiring players.",
    ageGroup: "Ages 11–14",
    ageGroupLabel: "Ages 11–14",
    ageMin: 11,
    ageMax: 14,
    approvedFee: "40000",
  },
] as const;

const singleBySlugOrName = async (model: any, slug: string, name: string, transaction: any) => {
  const bySlug = await model.findAll({ where: { slug }, transaction, lock: transaction.LOCK.UPDATE });
  if (bySlug.length > 1) throw new Error(`Multiple ${model.tableName} rows use website slug ${slug}.`);
  const byName = await model.findAll({ where: { name }, transaction, lock: transaction.LOCK.UPDATE });
  if (byName.length > 1) throw new Error(`Multiple ${model.tableName} rows use website name ${name}.`);
  if (bySlug[0] && byName[0] && bySlug[0].id !== byName[0].id) {
    throw new Error(`${model.tableName} slug ${slug} and name ${name} identify different records.`);
  }
  if (!bySlug[0] && byName[0]) {
    throw new Error(`${model.tableName} name ${name} already exists without the website slug ${slug}; refusing to alter it.`);
  }
  return bySlug[0] ?? null;
};

const seed = async () => {
  const result = await sequelize.transaction(async (transaction) => {
    await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:seedKey))", {
      replacements: { seedKey: "htt-public-centres-seed-v1" }, transaction,
    });

    let centresCreated = 0;
    let programmesCreated = 0;
    let associationsCreated = 0;
    const centreRows: any[] = [];
    const programmeRows: any[] = [];

    for (const centre of websiteCentres) {
      let row = await singleBySlugOrName(models.Centre, centre.slug, centre.name, transaction);
      if (!row) {
        row = await models.Centre.create({
          ...centre,
          ageGroups: ["8–11", "11–14"],
          comingSoon: false,
          registrationAvailable: true,
          reviewStatus: "approved",
          status: "open_for_registration",
          proposedArea: false,
        }, { transaction }) as any;
        centresCreated += 1;
      }
      if (row.name !== centre.name || row.status !== "open_for_registration" || row.reviewStatus !== "approved" || row.proposedArea !== false) {
        throw new Error(`Existing centre ${centre.slug} does not match the public registration configuration; no data was overwritten.`);
      }
      centreRows.push(row);
    }

    for (const programme of websiteProgrammes) {
      let row = await singleBySlugOrName(models.Programme, programme.slug, programme.name, transaction);
      if (!row) {
        row = await models.Programme.create({
          ...programme,
          currency: "NGN",
          availability: "open",
          status: "active",
        }, { transaction }) as any;
        programmesCreated += 1;
      }
      if (row.name !== programme.name || Number(row.ageMin) !== programme.ageMin || Number(row.ageMax) !== programme.ageMax || Number(row.approvedFee) !== Number(programme.approvedFee) || row.currency !== "NGN" || row.status !== "active") {
        throw new Error(`Existing programme ${programme.slug} does not match the public CENTRES data; no data was overwritten.`);
      }
      programmeRows.push(row);
    }

    for (const centre of centreRows) {
      for (const programme of programmeRows) {
        const [, created] = await models.CentreProgramme.findOrCreate({
          where: { centreId: centre.id, programmeId: programme.id },
          defaults: { centreId: centre.id, programmeId: programme.id },
          transaction,
        });
        if (created) associationsCreated += 1;
      }
    }

    const resolved = [];
    for (const [index, centre] of websiteCentres.entries()) {
      const centreFound = await models.Centre.findOne({
        where: { slug: centre.slug, status: "open_for_registration", reviewStatus: "approved", proposedArea: false },
        transaction,
      });
      const programmesFound = await models.Programme.findAll({
        where: { slug: { [Op.in]: websiteProgrammes.map((programme) => programme.slug) }, status: "active" },
        include: [{ model: models.Centre, as: "centres", where: { id: centreRows[index].id }, through: { attributes: [] }, required: true }],
        transaction,
      });
      if (!centreFound || programmesFound.length !== 2) throw new Error(`Public lookup verification failed for ${centre.slug}.`);
      resolved.push({ centreId: centreFound.id, slug: centre.slug, programmeCount: programmesFound.length });
    }

    return { centresCreated, programmesCreated, associationsCreated, resolved };
  });

  console.info(JSON.stringify(result, null, 2));
};

seed().catch((error) => {
  console.error(`Public centre seed failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
}).finally(async () => {
  await sequelize.close();
});
