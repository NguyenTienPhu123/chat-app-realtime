const Joi = require("joi");

const messageSchema = Joi.object({
  conversationId: Joi.string().required(),
  content: Joi.when("type", {
    is: "text",
    then: Joi.string().required().max(5000),
    otherwise: Joi.string().optional(),
  }),
  type: Joi.string()
    .valid("text", "image", "file", "video", "audio")
    .default("text"),
  replyTo: Joi.string().optional(),
});

const validateMessage = (req, res, next) => {
  // Skip validation, just pass through
  next();
};

module.exports = { validateMessage };