const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data');
const UPLOADS = path.join(__dirname, 'uploads');
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const read = (name, fallback) => {
  const p = path.join(DATA, name + '.json');
  if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(fallback, null, 2));
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
};
const write = (name, value) => fs.writeFileSync(path.join(DATA, name + '.json'), JSON.stringify(value, null, 2));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let products = read('products', [
  {id:'p1',name:'Classic Black Shirt',category:'Men',price:899,oldPrice:1299, sizes:['S','M','L','XL'],colors:['Black','White'],stock:20,image:'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800',description:'A smart everyday shirt with a premium finish.',active:true},
  {id:'p2',name:'Elegant Women Kurti',category:'Women',price:1199,oldPrice:1599,sizes:['S','M','L','XL','XXL'],colors:['Black','Gold'],stock:15,image:'https://images.unsplash.com/photo-1583391733956-6c78276477e7?w=800',description:'Elegant style for everyday and festive occasions.',active:true},
  {id:'p3',name:'Kids Casual Set',category:'Kids',price:699,oldPrice:999,sizes:['2Y','4Y','6Y','8Y'],colors:['Blue','Cream'],stock:12,image:'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=800',description:'Comfortable kidswear for everyday fun.',active:true},
  {id:'p4',name:'Premium Denim Jeans',category:'Men',price:1499,oldPrice:1899,sizes:['30','32','34','36'],colors:['Blue','Black'],stock:10,image:'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800',description:'Modern fit denim jeans.',active:true}
]);
write('products', products);
let users = read('users', []);
let orders = read('orders', []);
let returns = read('returns', []);
let adminHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
let configuredAdmin = process.env.ADMIN_EMAIL || 'admin@mariamsheikh.in';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  secret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  resave:false, saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:7*24*60*60*1000}
}));
app.use('/uploads', express.static(UPLOADS));
app.use(express.static(path.join(__dirname,'public')));

const upload = multer({storage:multer.diskStorage({
  destination:(req,file,cb)=>cb(null,UPLOADS),
  filename:(req,file,cb)=>cb(null,Date.now()+'-'+file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_'))
}), limits:{fileSize:5*1024*1024}, fileFilter:(req,file,cb)=>{
  cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype));
}});

const customer = (req,res,next) => req.session.userId ? next() : res.status(401).json({error:'Please log in first.'});
const admin = (req,res,next) => req.session.isAdmin ? next() : res.status(401).json({error:'Admin login required.'});

app.get('/api/products',(req,res)=>{
  res.json(products.filter(p=>p.active).map(({...p})=>p));
});
app.get('/api/me',(req,res)=>{
  const u=users.find(x=>x.id===req.session.userId);
  res.json({user:u?{id:u.id,name:u.name,email:u.email,phone:u.phone}:null,isAdmin:!!req.session.isAdmin});
});
app.post('/api/register',async(req,res)=>{
  const {name,email,password,phone}=req.body||{};
  if(!name||!email||!password||String(password).length<6) return res.status(400).json({error:'Name, email and password (minimum 6 characters) are required.'});
  if(users.some(u=>u.email.toLowerCase()===String(email).toLowerCase())) return res.status(409).json({error:'This email is already registered.'});
  const u={id:uid(),name:String(name).slice(0,80),email:String(email).toLowerCase(),phone:String(phone||''),password:await bcrypt.hash(String(password),10)};
  users.push(u); write('users',users); req.session.userId=u.id;
  res.json({ok:true,user:{id:u.id,name:u.name,email:u.email,phone:u.phone}});
});
app.post('/api/login',async(req,res)=>{
  const {email,password}=req.body||{};
  const u=users.find(x=>x.email===String(email||'').toLowerCase());
  if(!u||!await bcrypt.compare(String(password||''),u.password)) return res.status(401).json({error:'Email or password is incorrect.'});
  req.session.userId=u.id; res.json({ok:true,user:{id:u.id,name:u.name,email:u.email,phone:u.phone}});
});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.post('/api/orders',customer,(req,res)=>{
  const {items,address,paymentMethod}=req.body||{};
  if(!Array.isArray(items)||!items.length||!address) return res.status(400).json({error:'Cart and delivery address are required.'});
  const clean=[]; let total=0;
  for(const item of items){
    const p=products.find(x=>x.id===item.id&&x.active);
    const qty=Math.max(1,Math.min(10,Number(item.qty)||1));
    if(!p||p.stock<qty) return res.status(400).json({error:`${p?.name||'Product'} is unavailable or has insufficient stock.`});
    clean.push({id:p.id,name:p.name,price:p.price,qty,size:item.size||'',color:item.color||'',image:p.image});
    total+=p.price*qty;
  }
  clean.forEach(i=>{const p=products.find(x=>x.id===i.id);p.stock-=i.qty;});
  const order={id:'MS'+Date.now().toString().slice(-8),userId:req.session.userId,items:clean,total,shipping:0,address:String(address).slice(0,500),paymentMethod:paymentMethod==='COD'?'COD':'ONLINE_PENDING',paymentStatus:paymentMethod==='COD'?'Pay on delivery':'Payment pending',status:'Pending',createdAt:new Date().toISOString()};
  orders.unshift(order); write('orders',orders); write('products',products);
  res.json({ok:true,order});
});
app.get('/api/my-orders',customer,(req,res)=>res.json(orders.filter(o=>o.userId===req.session.userId)));
app.post('/api/returns',customer,(req,res)=>{
  const {orderId,reason}=req.body||{};
  const o=orders.find(x=>x.id===orderId&&x.userId===req.session.userId);
  if(!o||o.status!=='Delivered') return res.status(400).json({error:'Only delivered orders can be submitted for return in this starter.'});
  const r={id:uid(),orderId,reason:String(reason||'Other').slice(0,300),status:'Requested',createdAt:new Date().toISOString()};
  returns.unshift(r); write('returns',returns); res.json({ok:true,returnRequest:r});
});

app.post('/api/admin/login',async(req,res)=>{
  const {email,password}=req.body||{};
  const ok=String(email||'').toLowerCase()===configuredAdmin.toLowerCase() && await bcrypt.compare(String(password||''),adminHash);
  if(!ok) return res.status(401).json({error:'Invalid admin credentials.'});
  req.session.isAdmin=true; res.json({ok:true});
});
app.post('/api/admin/logout',(req,res)=>{req.session.isAdmin=false;res.json({ok:true});});
app.get('/api/admin/summary',admin,(req,res)=>res.json({
  products:products.length,customers:users.length,orders:orders.length,
  revenue:orders.filter(o=>o.paymentStatus==='Paid'||o.paymentMethod==='COD').reduce((s,o)=>s+o.total,0),
  pending:orders.filter(o=>o.status==='Pending').length
}));
app.get('/api/admin/products',admin,(req,res)=>res.json(products));
app.post('/api/admin/products',admin,upload.single('image'),(req,res)=>{
  const b=req.body||{};
  if(!b.name||!Number(b.price)||!b.category) return res.status(400).json({error:'Name, category and valid price are required.'});
  const p={id:uid(),name:b.name,category:b.category,price:Number(b.price),oldPrice:Number(b.oldPrice)||Number(b.price),sizes:String(b.sizes||'S,M,L,XL').split(',').map(x=>x.trim()),colors:String(b.colors||'Black').split(',').map(x=>x.trim()),stock:Math.max(0,Number(b.stock)||0),image:req.file?'/uploads/'+req.file.filename:(b.image||''),description:b.description||'',active:true};
  products.unshift(p); write('products',products); res.json({ok:true,product:p});
});
app.put('/api/admin/products/:id',admin,(req,res)=>{
  const p=products.find(x=>x.id===req.params.id); if(!p)return res.status(404).json({error:'Product not found.'});
  Object.assign(p,req.body); p.price=Number(p.price);p.stock=Number(p.stock);write('products',products);res.json({ok:true,product:p});
});
app.delete('/api/admin/products/:id',admin,(req,res)=>{
  const p=products.find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Product not found.'});
  p.active=false;write('products',products);res.json({ok:true});
});
app.get('/api/admin/orders',admin,(req,res)=>res.json(orders));
app.patch('/api/admin/orders/:id',admin,(req,res)=>{
  const o=orders.find(x=>x.id===req.params.id);if(!o)return res.status(404).json({error:'Order not found.'});
  const allowed=['Pending','Confirmed','Processing','Shipped','Out for Delivery','Delivered','Cancelled'];
  if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid order status.'});
  o.status=req.body.status;write('orders',orders);res.json({ok:true,order:o});
});
app.get('/api/admin/returns',admin,(req,res)=>res.json(returns));
app.patch('/api/admin/returns/:id',admin,(req,res)=>{
  const r=returns.find(x=>x.id===req.params.id);if(!r)return res.status(404).json({error:'Return not found.'});
  if(!['Approved','Rejected','Refund processing','Refunded'].includes(req.body.status))return res.status(400).json({error:'Invalid return status.'});
  r.status=req.body.status;write('returns',returns);res.json({ok:true,returnRequest:r});
});

app.get('/api/health',(req,res)=>res.json({ok:true,store:'Mariam Sheikh Fashion Store'}));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'Server error. Please try again.'});});
app.listen(PORT,()=>console.log(`Mariam Sheikh Fashion Store running on port ${PORT}`));
