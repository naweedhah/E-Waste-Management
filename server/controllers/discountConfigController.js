import AppConfig from '../models/AppConfig.js';

const ensureConfig = async () => {
  let cfg = await AppConfig.findOne();
  // ⭐️ Updated default structure to match what is being saved
  if (!cfg) cfg = await AppConfig.create({ 
      bulkDiscount: { 
          active: false, 
          percent: 0,
          name: 'Default Bulk Discount',
          description: '',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      } 
  });
  return cfg;
};

export const getBulkDiscount = async (req, res) => {
  try {
    const cfg = await ensureConfig();
    // ⭐️ Updated: Destructure all fields for the bulk discount config
    const { 
        active, 
        percent, 
        name, 
        description, 
        startDate, 
        endDate 
    } = cfg.bulkDiscount || { active: false, percent: 0 };
    res.json({ success: true, data: { active, percent, name, description, startDate, endDate } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load discount config' });
  }
};
